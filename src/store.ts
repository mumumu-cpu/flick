import { useSyncExternalStore } from 'react'
import type { Status, Task, User } from '../shared/types'
import { api, HttpError } from './api'

type SyncState = 'idle' | 'syncing' | 'offline' | 'error'

interface State {
  tasks: Record<string, Task>
  dirty: Record<string, true>
  user: User | null
  /** true until /api/me has answered at least once */
  authPending: boolean
  /** true while a signed-in user has never received a server list on this device */
  firstLoad: boolean
  sync: SyncState
}

const K = { tasks: 'flick:tasks', dirty: 'flick:dirty', user: 'flick:user', synced: 'flick:synced' }

const read = <T,>(k: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(k)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
const write = (k: string, v: unknown) => {
  try {
    if (v === null) localStorage.removeItem(k)
    else localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* storage full or blocked */
  }
}

const cachedUser = read<User | null>(K.user, null)
let state: State = {
  tasks: read(K.tasks, {}),
  dirty: read(K.dirty, {}),
  user: cachedUser,
  authPending: true,
  firstLoad: !!cachedUser && !read(K.synced, false),
  sync: 'idle',
}

const listeners = new Set<() => void>()
function set(patch: Partial<State>) {
  state = { ...state, ...patch }
  if (patch.tasks) write(K.tasks, state.tasks)
  if (patch.dirty) write(K.dirty, state.dirty)
  if ('user' in patch) write(K.user, state.user)
  listeners.forEach((l) => l())
}

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => select(state),
  )
}
export const getState = () => state

const uid = () => crypto.randomUUID()

function put(tasks: Task[]) {
  const next = { ...state.tasks }
  const dirty = { ...state.dirty }
  for (const t of tasks) {
    if (t.deleted && !state.user) {
      // Signed out: nothing to tell a server, so drop the row outright.
      delete next[t.id]
      delete dirty[t.id]
      continue
    }
    next[t.id] = t
    dirty[t.id] = true
  }
  set({ tasks: next, dirty })
  scheduleSync()
}

export function addTasks(texts: string[], status: Status = 'todo'): Task[] {
  const now = Date.now()
  const tasks = texts
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text, i) => ({ id: uid(), text, status, position: now + texts.length - i, created_at: now, updated_at: now }))
  put(tasks)
  return tasks
}

export function updateTask(id: string, patch: Partial<Pick<Task, 'text' | 'status'>>) {
  const t = state.tasks[id]
  if (!t) return
  const now = Date.now()
  put([{ ...t, ...patch, position: patch.status && patch.status !== t.status ? now : t.position, updated_at: now }])
}

export function deleteTask(id: string): Task | undefined {
  const t = state.tasks[id]
  if (!t) return
  put([{ ...t, deleted: true, updated_at: Date.now() }])
  return t
}

export function restoreTask(t: Task) {
  put([{ ...t, deleted: false, updated_at: Date.now() }])
}

let timer: ReturnType<typeof setTimeout> | undefined
let running: Promise<void> | null = null
let again = false

export function scheduleSync(delay = 500) {
  if (!state.user) return
  clearTimeout(timer)
  timer = setTimeout(() => void syncNow(), delay)
}

export async function syncNow(): Promise<void> {
  if (!state.user) return
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    const sent = Object.keys(state.dirty).map((id) => state.tasks[id]).filter(Boolean)
    const sentAt = new Map(sent.map((t) => [t.id, t.updated_at]))
    set({ sync: 'syncing' })
    try {
      const { tasks } = await api.sync(sent)
      const next: Record<string, Task> = {}
      for (const t of tasks) next[t.id] = t
      const dirty: Record<string, true> = {}
      // Keep local edits made while the request was in flight.
      for (const id of Object.keys(state.dirty)) {
        const local = state.tasks[id]
        if (!local) continue
        if (sentAt.get(id) === local.updated_at) continue
        dirty[id] = true
        if (local.deleted) delete next[id]
        else next[id] = local
      }
      write(K.synced, true)
      set({ tasks: next, dirty, sync: 'idle', firstLoad: false })
    } catch (e) {
      if (e instanceof HttpError && e.status === 401) {
        set({ user: null, sync: 'idle', firstLoad: false })
      } else {
        set({ sync: navigator.onLine ? 'error' : 'offline' })
      }
    }
  })()
  try {
    await running
  } finally {
    running = null
    if (again) {
      again = false
      scheduleSync(0)
    }
  }
}

export async function loadUser() {
  try {
    const { user } = await api.me()
    if (user && state.user && user.id !== state.user.id) {
      // Different account on this device: drop the previous account's cache.
      set({ tasks: {}, dirty: {}, firstLoad: true })
      write(K.synced, null)
    }
    set({ user, authPending: false, firstLoad: user ? state.firstLoad || !read(K.synced, false) : false })
    if (user) await syncNow()
  } catch {
    set({ authPending: false, sync: navigator.onLine ? 'error' : 'offline', firstLoad: false })
  }
}

export async function logout() {
  await api.logout().catch(() => undefined)
  write(K.synced, null)
  set({ user: null, tasks: {}, dirty: {}, firstLoad: false })
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => scheduleSync(0))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleSync(0)
  })
  setInterval(() => document.visibilityState === 'visible' && scheduleSync(0), 30_000)
}
