import { animate, motion, useMotionValue, useMotionValueEvent, useTransform, type PanInfo } from 'motion/react'
import { forwardRef, useRef, useState } from 'react'
import type { Task } from '../../shared/types'
import { haptic, relTime, STATUS_META, SWIPE, type SwipeAction } from '../status'
import { IconCheck, IconCircle, IconHalf, IconTrash } from './icons'

const ICON = { todo: IconCircle, doing: IconHalf, done: IconCheck }

function ActionHint({ action, side, progress }: { action: SwipeAction; side: 'left' | 'right'; progress: ReturnType<typeof useTransform<number, number>> }) {
  const color = action.kind === 'delete' ? 'var(--danger)' : STATUS_META[action.to].color
  const label = action.kind === 'delete' ? '削除' : STATUS_META[action.to].label
  const Icon = action.kind === 'delete' ? IconTrash : ICON[action.to]
  const scale = useTransform(progress, [0, 1], [0.6, 1.15])
  const opacity = useTransform(progress, [0, 0.35, 1], [0, 0.6, 1])
  return (
    <motion.div
      className="absolute inset-y-0 flex items-center gap-2 px-6 text-[15px] font-semibold"
      style={{ [side === 'left' ? 'left' : 'right']: 0, color, opacity, scale, flexDirection: side === 'left' ? 'row' : 'row-reverse' }}
    >
      <Icon width={24} height={24} />
      <span>{label}</span>
    </motion.div>
  )
}

interface Props {
  task: Task
  onAction: (task: Task, action: SwipeAction) => void
  onOpen: (task: Task) => void
}

export const TaskCard = forwardRef<HTMLLIElement, Props>(function TaskCard({ task, onAction, onOpen }, ref) {
  const x = useMotionValue(0)
  const width = useRef(360)
  const armed = useRef<0 | 1 | -1>(0)
  const [armedSide, setArmedSide] = useState<0 | 1 | -1>(0)
  const dragging = useRef(false)
  const swipe = SWIPE[task.status]
  const threshold = () => Math.min(140, width.current * 0.32)

  const right = useTransform(x, (v) => Math.max(0, Math.min(1, v / threshold())))
  const left = useTransform(x, (v) => Math.max(0, Math.min(1, -v / threshold())))
  const tint = useTransform(x, (v) => {
    const a = swipe[v > 0 ? 'right' : 'left']
    const c = a.kind === 'delete' ? '239,68,68' : { todo: '59,130,246', doing: '245,158,11', done: '16,185,129' }[a.to]
    return `rgba(${c},${Math.min(0.16, (Math.abs(v) / threshold()) * 0.16)})`
  })
  const rotate = useTransform(x, [-300, 0, 300], [-2.5, 0, 2.5])

  useMotionValueEvent(x, 'change', (v) => {
    const t = threshold()
    const side = v > t ? 1 : v < -t ? -1 : 0
    if (side !== armed.current) {
      armed.current = side
      setArmedSide(side)
      if (side !== 0) haptic(10)
    }
  })

  const end = (_: unknown, info: PanInfo) => {
    const v = x.get()
    const fling = Math.abs(info.velocity.x) > 650 && Math.abs(v) > 40
    const dir = v > 0 ? 1 : -1
    if (Math.abs(v) > threshold() || fling) {
      haptic(14)
      animate(x, dir * (width.current + 60), { type: 'spring', stiffness: 380, damping: 40, velocity: info.velocity.x })
      setTimeout(() => onAction(task, swipe[dir > 0 ? 'right' : 'left']), 120)
    } else {
      animate(x, 0, { type: 'spring', stiffness: 520, damping: 34 })
    }
    setTimeout(() => (dragging.current = false), 0)
  }

  const Icon = ICON[task.status]
  return (
    <motion.li
      ref={ref}
      layout
      initial={{ opacity: 0, y: -14, scale: 0.96, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 0.9, height: 0, marginBottom: 0, filter: 'blur(6px)', transition: { duration: 0.28, ease: [0.32, 0.72, 0, 1] } }}
      transition={{ type: 'spring', stiffness: 420, damping: 36, mass: 0.8 }}
      className="relative mb-2.5 list-none"
      data-testid="task"
      data-status={task.status}
    >
      <motion.div className="absolute inset-0 overflow-hidden rounded-[24px]" style={{ background: tint }} aria-hidden>
        <ActionHint action={swipe.right} side="left" progress={right} />
        <ActionHint action={swipe.left} side="right" progress={left} />
      </motion.div>
      <motion.div
        className="glass relative flex cursor-grab touch-pan-y items-start gap-3 !rounded-[24px] px-4 py-3.5 select-none active:cursor-grabbing"
        style={{ x, rotate }}
        drag="x"
        dragDirectionLock
        dragMomentum={false}
        onDragStart={(e) => {
          dragging.current = true
          width.current = ((e.target as HTMLElement).closest('li') as HTMLElement)?.offsetWidth ?? 360
        }}
        onDragEnd={end}
        whileTap={{ scale: 0.985 }}
        onTap={() => !dragging.current && onOpen(task)}
        role="button"
        tabIndex={0}
        aria-label={`${task.text}（${STATUS_META[task.status].label}）`}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onOpen(task)
          if (e.key === 'ArrowRight') onAction(task, swipe.right)
          if (e.key === 'ArrowLeft') onAction(task, swipe.left)
        }}
      >
        <motion.span
          className="relative z-[1] mt-[3px] shrink-0"
          style={{ color: STATUS_META[task.status].color }}
          animate={{ scale: armedSide ? 1.15 : 1 }}
        >
          <Icon width={20} height={20} />
        </motion.span>
        <div className="relative z-[1] min-w-0 flex-1">
          <p
            className={`line-clamp-4 text-[16px] leading-[1.5] break-words whitespace-pre-wrap ${task.status === 'done' ? 'text-[var(--ink-3)] line-through decoration-[1.5px]' : ''}`}
            data-testid="task-text"
          >
            {task.text}
          </p>
          <p className="mt-1 text-[12px] text-[var(--ink-3)] tabular-nums">{relTime(task.updated_at)}</p>
        </div>
      </motion.div>
    </motion.li>
  )
})
