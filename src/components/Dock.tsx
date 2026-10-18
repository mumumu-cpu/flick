import { motion } from 'motion/react'
import type { Status } from '../../shared/types'
import { STATUSES } from '../../shared/types'
import { STATUS_META } from '../status'
import { IconCheck, IconCircle, IconHalf } from './icons'

const ICON = { todo: IconCircle, doing: IconHalf, done: IconCheck }

export function Dock({ value, counts, onChange }: { value: Status; counts: Record<Status, number>; onChange: (s: Status) => void }) {
  return (
    <motion.nav
      className="dock glass refract pointer-events-auto mx-auto flex w-full max-w-[380px] gap-1 !rounded-full p-1.5"
      initial={{ y: 80, opacity: 0, scale: 0.9 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26, delay: 0.08 }}
      role="tablist"
      aria-label="ステータス"
    >
      {STATUSES.map((s) => {
        const Icon = ICON[s]
        const active = s === value
        return (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={active}
            data-testid={`tab-${s}`}
            onClick={() => onChange(s)}
            className="relative flex h-[52px] flex-1 flex-col items-center justify-center rounded-full text-[11.5px] font-semibold"
            style={{ color: active ? STATUS_META[s].color : 'var(--ink-3)' }}
          >
            {active && (
              <motion.span
                layoutId="dock-pill"
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'rgba(255,255,255,.85)',
                  boxShadow: '0 4px 14px -4px rgba(28,40,90,.22), inset 0 1px 0 #fff, inset 0 -1px 0 rgba(28,40,90,.05)',
                }}
                transition={{ type: 'spring', stiffness: 460, damping: 34 }}
              />
            )}
            <span className="relative flex items-center gap-1">
              <Icon width={18} height={18} />
              <motion.span
                key={counts[s]}
                initial={{ y: -6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="min-w-[1ch] text-[13px] tabular-nums"
                data-testid={`count-${s}`}
              >
                {counts[s]}
              </motion.span>
            </span>
            <span className="relative mt-0.5">{STATUS_META[s].label}</span>
          </button>
        )
      })}
    </motion.nav>
  )
}
