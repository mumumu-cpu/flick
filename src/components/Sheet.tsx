import { AnimatePresence, motion, useDragControls, type PanInfo } from 'motion/react'
import { useEffect, type ReactNode } from 'react'

export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  const controls = useDragControls()
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={label}>
          <motion.div
            className="absolute inset-0 bg-[rgba(20,24,40,.18)]"
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(6px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            onClick={onClose}
            data-testid="sheet-backdrop"
          />
          <motion.div
            className="glass relative w-full max-w-[560px] !rounded-b-none !rounded-t-[34px] px-5 pt-2"
            style={{ paddingBottom: 'calc(var(--safe-b) + 20px)', background: 'linear-gradient(160deg, rgba(255,255,255,.97), rgba(250,251,255,.9))' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            drag="y"
            dragListener={false}
            dragControls={controls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.8 }}
            onDragEnd={(_, i: PanInfo) => (i.offset.y > 100 || i.velocity.y > 500) && onClose()}
          >
            <div className="flex cursor-grab touch-none justify-center py-2" onPointerDown={(e) => controls.start(e)}>
              <span className="h-[5px] w-10 rounded-full bg-[rgba(13,16,23,.15)]" />
            </div>
            <div className="relative z-[1]">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
