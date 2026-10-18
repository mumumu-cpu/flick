import { AnimatePresence, motion } from 'motion/react'
import { useLayoutEffect, useRef, useState } from 'react'
import { MAX_TEXT } from '../../shared/types'
import { IconSplit, IconUp, IconWand } from './icons'

interface Props {
  onSubmit: (text: string) => void
  onSplit: (text: string) => Promise<boolean>
  onPolish: (text: string) => Promise<string | null>
}

const DRAFT = 'flick:draft'

export function Composer({ onSubmit, onSplit, onPolish }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  // Start from whatever was typed into the pre-JS boot textarea.
  const [text, setText] = useState(() => (document.getElementById('boot-memo') as HTMLTextAreaElement | null)?.value ?? '')
  const [busy, setBusy] = useState<null | 'split' | 'polish'>(null)
  const composing = useRef(false)

  // Take over focus and caret from the boot textarea, then remove the boot shell.
  useLayoutEffect(() => {
    const boot = document.getElementById('boot-memo') as HTMLTextAreaElement | null
    const el = ref.current!
    if (boot) {
      const hadFocus = document.activeElement === boot
      const { selectionStart, selectionEnd } = boot
      if (hadFocus || !('ontouchstart' in window)) {
        el.focus({ preventScroll: true })
        el.setSelectionRange(selectionStart, selectionEnd)
      }
      document.getElementById('boot')?.remove()
    }
    resize(el)
  }, [])

  const change = (v: string) => {
    setText(v)
    try {
      localStorage.setItem(DRAFT, v)
    } catch {
      /* ignore */
    }
    requestAnimationFrame(() => resize(ref.current))
  }

  const submit = () => {
    const v = text.trim()
    if (!v) return
    onSubmit(v)
    change('')
    ref.current?.focus()
  }

  const run = async (kind: 'split' | 'polish') => {
    const v = text.trim()
    if (!v || busy) return
    setBusy(kind)
    try {
      if (kind === 'split') {
        if (await onSplit(v)) change('')
      } else {
        const out = await onPolish(v)
        if (out) change(out)
      }
    } finally {
      setBusy(null)
    }
  }

  const has = text.trim().length > 0
  return (
    <motion.div
      className={`glass composer ${busy ? 'ai-busy' : ''}`}
      layout
      transition={{ type: 'spring', stiffness: 400, damping: 34 }}
    >
      <textarea
        ref={ref}
        rows={2}
        value={text}
        maxLength={MAX_TEXT}
        placeholder="メモ"
        aria-label="メモ"
        data-testid="composer"
        enterKeyHint="send"
        readOnly={!!busy}
        onChange={(e) => change(e.target.value)}
        onCompositionStart={() => (composing.current = true)}
        onCompositionEnd={() => (composing.current = false)}
        onKeyDown={(e) => {
          // Enter adds; Shift+Enter breaks the line. Never submit while an IME is converting.
          if (e.key === 'Enter' && !e.shiftKey && !composing.current && !e.nativeEvent.isComposing && e.keyCode !== 229) {
            e.preventDefault()
            submit()
          }
        }}
      />
      <div className="composer-bar">
        <AnimatePresence initial={false}>
          {has && (
            <motion.div
              key="ai"
              className="flex gap-1.5"
              initial={{ opacity: 0, x: -8, filter: 'blur(4px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: -8, filter: 'blur(4px)' }}
              transition={{ duration: 0.22 }}
            >
              <AiButton label="分解" busy={busy === 'split'} disabled={!!busy} onClick={() => run('split')} testId="ai-split">
                <IconSplit width={17} height={17} />
              </AiButton>
              <AiButton label="整える" busy={busy === 'polish'} disabled={!!busy} onClick={() => run('polish')} testId="ai-polish">
                <IconWand width={17} height={17} />
              </AiButton>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex-1" />
        <motion.button
          type="button"
          aria-label="追加"
          data-testid="submit"
          onClick={submit}
          disabled={!has || !!busy}
          className="grid h-10 w-10 place-items-center rounded-full text-white"
          animate={{
            scale: has ? 1 : 0.86,
            opacity: has ? 1 : 0.35,
            background: has ? 'linear-gradient(160deg,#2b2f3a,#0d1017)' : 'linear-gradient(160deg,#9aa0ad,#7d8492)',
          }}
          whileTap={{ scale: 0.88 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          style={{ boxShadow: has ? '0 6px 18px -6px rgba(13,16,23,.55), inset 0 1px 0 rgba(255,255,255,.25)' : 'none' }}
        >
          <IconUp width={20} height={20} strokeWidth={2.3} />
        </motion.button>
      </div>
    </motion.div>
  )
}

function AiButton(props: { label: string; busy: boolean; disabled: boolean; onClick: () => void; testId: string; children: React.ReactNode }) {
  return (
    <motion.button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      data-testid={props.testId}
      whileTap={{ scale: 0.92 }}
      className="chip relative flex h-9 items-center gap-1.5 overflow-hidden rounded-full px-3 text-[13.5px] font-medium text-[var(--ink-2)] disabled:opacity-60"
    >
      <motion.span animate={props.busy ? { rotate: [0, 180, 360], scale: [1, 1.2, 1] } : { rotate: 0, scale: 1 }} transition={props.busy ? { repeat: Infinity, duration: 1.2, ease: 'easeInOut' } : {}}>
        {props.children}
      </motion.span>
      {props.label}
    </motion.button>
  )
}

function resize(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}
