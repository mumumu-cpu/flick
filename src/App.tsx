import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Status, Task } from '../shared/types'
import { STATUSES } from '../shared/types'
import { api, HttpError } from './api'
import { AccountSheet, Avatar } from './components/AccountSheet'
import { Composer } from './components/Composer'
import { Dock } from './components/Dock'
import { IconExpand, IconShrink, IconUser } from './components/icons'
import { FullscreenLoader, SkeletonList } from './components/Loading'
import { TaskCard } from './components/TaskCard'
import { TaskSheet } from './components/TaskSheet'
import { Toast, type ToastData } from './components/Toast'
import { haptic, STATUS_META, type SwipeAction } from './status'
import { addTasks, deleteTask, loadUser, logout, restoreTask, updateTask, useStore } from './store'

const TAB_KEY = 'flick:tab'
const initialTab = (): Status => {
  try {
    const t = localStorage.getItem(TAB_KEY) as Status | null
    return t && STATUSES.includes(t) ? t : 'todo'
  } catch {
    return 'todo'
  }
}

export default function App() {
  const taskMap = useStore((s) => s.tasks)
  const user = useStore((s) => s.user)
  const authPending = useStore((s) => s.authPending)
  const firstLoad = useStore((s) => s.firstLoad)
  const sync = useStore((s) => s.sync)

  const [tab, setTabState] = useState<Status>(initialTab)
  const [dir, setDir] = useState(1)
  const [openId, setOpenId] = useState<string | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const [toast, setToast] = useState<ToastData | null>(() =>
    new URLSearchParams(location.search).get('auth') === 'failed' ? { id: 0, text: 'ログインできませんでした' } : null,
  )
  const [busyScreen, setBusyScreen] = useState(() => new URLSearchParams(location.search).get('auth') === 'ok')
  const [isFs, setIsFs] = useState(false)
  const [paneSettled, setPaneSettled] = useState(true)

  const setTab = useCallback((s: Status) => {
    setTabState((prev) => {
      setDir(STATUSES.indexOf(s) >= STATUSES.indexOf(prev) ? 1 : -1)
      return s
    })
    try {
      localStorage.setItem(TAB_KEY, s)
    } catch {
      /* ignore */
    }
  }, [])

  const notify = useCallback((text: string, undo?: () => void) => setToast({ id: Date.now() + Math.random(), text, undo }), [])

  useEffect(() => {
    if (location.search.includes('auth=')) history.replaceState(null, '', location.pathname)
    void loadUser().finally(() => setBusyScreen(false))
    const fs = () => setIsFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', fs)
    return () => document.removeEventListener('fullscreenchange', fs)
  }, [])

  const all = useMemo(() => Object.values(taskMap).filter((t) => !t.deleted), [taskMap])
  const counts = useMemo(() => {
    const c = { todo: 0, doing: 0, done: 0 } as Record<Status, number>
    for (const t of all) c[t.status]++
    return c
  }, [all])
  const list = useMemo(() => all.filter((t) => t.status === tab).sort((a, b) => b.position - a.position), [all, tab])
  const openTask = openId ? (taskMap[openId] && !taskMap[openId].deleted ? taskMap[openId] : null) : null

  const requireUser = () => {
    if (user) return true
    haptic()
    setAccountOpen(true)
    notify('AI機能はログイン後に使えます')
    return false
  }

  const aiError = (e: unknown) => notify(e instanceof HttpError && e.status === 429 ? 'AIの利用上限に達しました。少し待ってください' : 'AIが応答しませんでした')

  const split = async (text: string, status: Status = 'todo') => {
    if (!requireUser()) return false
    try {
      const { items } = await api.split(text)
      const created = addTasks(items, status)
      setTab(status)
      haptic(12)
      notify(`${created.length}件に分解しました`)
      return true
    } catch (e) {
      aiError(e)
      return false
    }
  }

  const polish = async (text: string) => {
    if (!requireUser()) return null
    try {
      const { text: out } = await api.polish(text)
      haptic(12)
      return out
    } catch (e) {
      aiError(e)
      return null
    }
  }

  const onAction = (task: Task, action: SwipeAction) => {
    if (action.kind === 'delete') {
      const prev = deleteTask(task.id)
      notify('削除しました', prev && (() => restoreTask(prev)))
    } else {
      const from = task.status
      updateTask(task.id, { status: action.to })
      notify(`${STATUS_META[action.to].label}へ`, () => updateTask(task.id, { status: from }))
    }
  }

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
    } catch {
      /* not allowed */
    }
  }

  const showSkeleton = !!user && firstLoad && list.length === 0

  return (
    <LayoutGroup>
      <div className="shell">
        <header className="flex h-11 shrink-0 items-center justify-between" style={{ marginBottom: 12 }}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.h1
              key={tab}
              className="flex items-baseline gap-2 pl-1 text-[26px] font-bold tracking-[-0.02em]"
              initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, filter: 'blur(6px)' }}
              transition={{ duration: 0.25 }}
            >
              {STATUS_META[tab].label}
              <span className="text-[17px] font-semibold tabular-nums" style={{ color: STATUS_META[tab].color }}>
                {counts[tab]}
              </span>
            </motion.h1>
          </AnimatePresence>
          <div className="flex items-center gap-2">
            {document.fullscreenEnabled && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={toggleFullscreen}
                aria-label={isFs ? '全画面を終了' : '全画面'}
                data-testid="fullscreen"
                className="glass grid h-11 w-11 place-items-center !rounded-full text-[var(--ink-2)]"
              >
                {isFs ? <IconShrink width={19} height={19} /> : <IconExpand width={19} height={19} />}
              </motion.button>
            )}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setAccountOpen(true)}
              aria-label="アカウント"
              data-testid="account"
              className="glass relative grid h-11 w-11 place-items-center !rounded-full text-[var(--ink-2)]"
            >
              {authPending && !user ? (
                <span className="sk-shimmer h-7 w-7 rounded-full" />
              ) : user ? (
                <Avatar user={user} size={34} />
              ) : (
                <IconUser width={21} height={21} />
              )}
              <AnimatePresence>
                {user && sync !== 'idle' && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: [1, 1.25, 1] }}
                    exit={{ scale: 0 }}
                    transition={{ repeat: sync === 'syncing' ? Infinity : 0, duration: 1 }}
                    data-testid="sync-dot"
                    className="absolute top-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white"
                    style={{ background: sync === 'syncing' ? 'var(--todo)' : 'var(--doing)' }}
                  />
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </header>

        <Composer
          onSubmit={(text) => {
            addTasks([text])
            haptic()
            if (tab !== 'todo') setTab('todo')
          }}
          onSplit={(t) => split(t)}
          onPolish={polish}
        />

        <main className="list-scroll relative -mx-4 mt-[18px] flex-1 overflow-x-hidden overflow-y-auto px-4" style={{ paddingBottom: 'calc(var(--safe-b) + 110px)' }}>
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <motion.div
              key={tab}
              custom={dir}
              variants={{
                enter: (d: number) => ({ x: d * 40, opacity: 0, filter: 'blur(4px)' }),
                center: { x: 0, opacity: 1, filter: 'blur(0px)' },
                exit: (d: number) => ({ x: d * -40, opacity: 0, filter: 'blur(4px)' }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              onAnimationStart={() => setPaneSettled(false)}
              onAnimationComplete={() => setPaneSettled(true)}
              data-testid="pane"
              data-settled={paneSettled}
            >
              {showSkeleton ? (
                <SkeletonList />
              ) : (
                <ul className="m-0 p-0" data-testid="task-list">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {list.map((t) => (
                      <TaskCard key={t.id} task={t} onAction={onAction} onOpen={(x) => setOpenId(x.id)} />
                    ))}
                  </AnimatePresence>
                  {list.length === 0 && (
                    <motion.div
                      key="empty"
                      data-testid="empty"
                      className="grid place-items-center pt-[12vh] text-[var(--ink-3)]"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                    >
                      <span className="glass grid h-16 w-16 place-items-center !rounded-full" style={{ color: STATUS_META[tab].color }}>
                        <motion.span animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}>
                          {tab === 'done' ? '✓' : tab === 'doing' ? '◐' : '○'}
                        </motion.span>
                      </span>
                    </motion.div>
                  )}
                </ul>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4" style={{ paddingBottom: 'calc(var(--safe-b) + 14px)' }}>
        <Dock value={tab} counts={counts} onChange={(s) => (haptic(5), setTab(s))} />
      </div>

      <TaskSheet
        task={openTask}
        onClose={() => setOpenId(null)}
        onSave={(id, patch) => updateTask(id, patch)}
        onDelete={(t) => {
          setOpenId(null)
          onAction(t, { kind: 'delete' })
        }}
        onSplit={split}
        onPolish={polish}
      />

      <AccountSheet
        open={accountOpen}
        user={user}
        syncing={sync === 'syncing'}
        onClose={() => setAccountOpen(false)}
        onLogin={() => {
          setBusyScreen(true)
          location.href = '/api/auth/google'
        }}
        onLogout={async () => {
          setAccountOpen(false)
          setBusyScreen(true)
          await logout()
          setBusyScreen(false)
        }}
      />

      <Toast toast={toast} onDone={() => setToast(null)} />
      <FullscreenLoader show={busyScreen} />
    </LayoutGroup>
  )
}
