import { motion } from 'motion/react'
import { useState } from 'react'
import type { Status, Task } from '../../shared/types'
import { MAX_TEXT, STATUSES } from '../../shared/types'
import { STATUS_META } from '../status'
import { IconSplit, IconTrash, IconWand } from './icons'
import { Sheet } from './Sheet'

interface Props {
  task: Task | null
  onClose: () => void
  onSave: (id: string, patch: { text?: string; status?: Status }) => void
  onDelete: (t: Task) => void
  onSplit: (text: string, status: Status) => Promise<boolean>
  onPolish: (text: string) => Promise<string | null>
}

export function TaskSheet({ task, onClose, onSave, onDelete, onSplit, onPolish }: Props) {
  const [text, setText] = useState(task?.text ?? '')
  const [busy, setBusy] = useState<null | 'split' | 'polish'>(null)
  // Reset only when a different task opens, so status changes keep unsaved edits.
  const [forId, setForId] = useState(task?.id)
  if (task && task.id !== forId) {
    setForId(task.id)
    setText(task.text)
  }

  const close = () => {
    if (task && text.trim() && text.trim() !== task.text) onSave(task.id, { text: text.trim() })
    onClose()
  }

  return (
    <Sheet open={!!task} onClose={close} label="タスク">
      {task && (
        <div className={busy ? 'ai-busy rounded-[22px]' : ''}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX_TEXT}
            rows={4}
            readOnly={!!busy}
            aria-label="タスクの内容"
            data-testid="sheet-text"
            className="w-full resize-none rounded-[22px] bg-white/60 px-4 py-3 text-[17px] leading-[1.55] outline-none focus:bg-white/85"
            style={{ boxShadow: 'inset 0 1px 3px rgba(13,16,23,.06)' }}
          />
          <div className="mt-3 flex gap-1.5 rounded-full bg-[rgba(13,16,23,.05)] p-1" role="radiogroup" aria-label="ステータス">
            {STATUSES.map((s) => (
              <button
                key={s}
                role="radio"
                aria-checked={task.status === s}
                data-testid={`sheet-status-${s}`}
                onClick={() => onSave(task.id, { status: s })}
                className="relative h-10 flex-1 rounded-full text-[14px] font-semibold"
                style={{ color: task.status === s ? STATUS_META[s].color : 'var(--ink-3)' }}
              >
                {task.status === s && (
                  <motion.span layoutId="sheet-pill" className="absolute inset-0 rounded-full bg-white shadow-[0_3px_10px_-4px_rgba(28,40,90,.3)]" transition={{ type: 'spring', stiffness: 460, damping: 34 }} />
                )}
                <span className="relative">{STATUS_META[s].label}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <SheetButton
              testId="sheet-polish"
              disabled={!!busy || !text.trim()}
              busy={busy === 'polish'}
              onClick={async () => {
                setBusy('polish')
                const out = await onPolish(text.trim()).finally(() => setBusy(null))
                if (out) setText(out)
              }}
            >
              <IconWand width={18} height={18} />
              整える
            </SheetButton>
            <SheetButton
              testId="sheet-split"
              disabled={!!busy || !text.trim()}
              busy={busy === 'split'}
              onClick={async () => {
                setBusy('split')
                const ok = await onSplit(text.trim(), task.status).finally(() => setBusy(null))
                if (ok) onClose()
              }}
            >
              <IconSplit width={18} height={18} />
              分解
            </SheetButton>
            <SheetButton testId="sheet-delete" danger onClick={() => onDelete(task)}>
              <IconTrash width={18} height={18} />
              削除
            </SheetButton>
          </div>
        </div>
      )}
    </Sheet>
  )
}

function SheetButton(p: { children: React.ReactNode; onClick: () => void; disabled?: boolean; busy?: boolean; danger?: boolean; testId: string }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={p.onClick}
      disabled={p.disabled}
      data-testid={p.testId}
      className="chip flex h-12 flex-1 items-center justify-center gap-1.5 rounded-[18px] text-[14.5px] font-semibold disabled:opacity-50"
      style={{ color: p.danger ? 'var(--danger)' : 'var(--ink-2)' }}
    >
      <motion.span className="flex items-center gap-1.5" animate={p.busy ? { opacity: [1, 0.4, 1] } : { opacity: 1 }} transition={p.busy ? { repeat: Infinity, duration: 1 } : {}}>
        {p.children}
      </motion.span>
    </motion.button>
  )
}
