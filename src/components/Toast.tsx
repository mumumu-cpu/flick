import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { IconUndo } from './icons'

export interface ToastData {
  id: number
  text: string
  undo?: () => void
}

const DURATION = 6000

export function Toast({ toast, onDone }: { toast: ToastData | null; onDone: () => void }) {
  // The countdown pauses while a finger or pointer rests on the toast.
  const [held, setHeld] = useState(false)
  useEffect(() => {
    if (!toast || held) return
    const t = setTimeout(onDone, DURATION)
    return () => clearTimeout(t)
  }, [toast, held, onDone])
  return (
    <div className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4" style={{ bottom: 'calc(var(--safe-b) + 96px)' }}>
      <AnimatePresence mode="popLayout">
        {toast && (
          <motion.div
            key={toast.id}
            role="status"
            data-testid="toast"
            onPointerEnter={() => setHeld(true)}
            onPointerLeave={() => setHeld(false)}
            className="pointer-events-auto flex items-center gap-3 rounded-full py-2 pr-2 pl-4 text-[14px] text-white"
            style={{ background: 'rgba(18,20,28,.82)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxShadow: '0 10px 30px -10px rgba(0,0,0,.4)' }}
            initial={{ y: 30, opacity: 0, scale: 0.9, filter: 'blur(6px)' }}
            animate={{ y: 0, opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ y: 20, opacity: 0, scale: 0.95, filter: 'blur(6px)' }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          >
            <span>{toast.text}</span>
            {toast.undo && (
              <motion.button
                whileTap={{ scale: 0.92 }}
                data-testid="undo"
                onClick={() => {
                  toast.undo?.()
                  onDone()
                }}
                className="flex h-8 items-center gap-1 rounded-full bg-white/15 px-3 font-semibold"
              >
                <IconUndo width={16} height={16} />
                元に戻す
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
