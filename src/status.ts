import type { Status } from '../shared/types'

export const STATUS_META: Record<Status, { label: string; color: string }> = {
  todo: { label: '未着手', color: 'var(--todo)' },
  doing: { label: '進行中', color: 'var(--doing)' },
  done: { label: '完了', color: 'var(--done)' },
}

export type SwipeAction = { kind: 'move'; to: Status } | { kind: 'delete' }

/** Right = forward, left = back. The ends of the flow delete. */
export const SWIPE: Record<Status, { right: SwipeAction; left: SwipeAction }> = {
  todo: { right: { kind: 'move', to: 'doing' }, left: { kind: 'delete' } },
  doing: { right: { kind: 'move', to: 'done' }, left: { kind: 'move', to: 'todo' } },
  done: { right: { kind: 'delete' }, left: { kind: 'move', to: 'doing' } },
}

export const haptic = (ms = 8) => {
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* unsupported */
  }
}

export function relTime(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 45) return 'たった今'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}分前`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}時間前`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}日前`
  return new Date(ts).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
}
