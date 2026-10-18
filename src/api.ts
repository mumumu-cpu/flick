import type { Task, User } from '../shared/types'

export class HttpError extends Error {
  status: number
  constructor(status: number) {
    super(`HTTP ${status}`)
    this.status = status
  }
}

async function req<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  })
  if (!res.ok) throw new HttpError(res.status)
  return res.json() as Promise<T>
}

export const api = {
  me: () => req<{ user: User | null }>('/api/me'),
  sync: (changes: Task[]) => req<{ tasks: Task[] }>('/api/sync', { changes }),
  logout: () => req<{ ok: true }>('/api/auth/logout', {}),
  split: (text: string) => req<{ items: string[] }>('/api/ai/split', { text }),
  polish: (text: string) => req<{ text: string }>('/api/ai/polish', { text }),
}
