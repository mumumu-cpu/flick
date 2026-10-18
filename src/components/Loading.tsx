import { AnimatePresence, motion } from 'motion/react'

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div data-testid="skeleton" aria-busy="true" aria-label="読み込み中">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className="glass sk-shimmer mb-2.5 flex gap-3 !rounded-[24px] px-4 py-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1 - i * 0.18, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ delay: i * 0.06 }}
        >
          <span className="h-5 w-5 shrink-0 rounded-full bg-[rgba(13,16,23,.07)]" />
          <span className="flex-1">
            <span className="block h-3.5 rounded-full bg-[rgba(13,16,23,.07)]" style={{ width: `${88 - i * 13}%` }} />
            <span className="mt-2.5 block h-2.5 w-14 rounded-full bg-[rgba(13,16,23,.05)]" />
          </span>
        </motion.div>
      ))}
    </div>
  )
}

/** Full-screen glass overlay with an orbiting loader. */
export function FullscreenLoader({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[60] grid place-items-center"
          data-testid="fullscreen-loader"
          role="progressbar"
          aria-label="読み込み中"
          initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          animate={{ opacity: 1, backdropFilter: 'blur(26px)' }}
          exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          transition={{ duration: 0.35 }}
          style={{ background: 'rgba(245,246,250,.55)' }}
        >
          <motion.div className="glass grid h-24 w-24 place-items-center !rounded-[32px]" initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
            <div className="relative h-10 w-10">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="absolute top-1/2 left-1/2 -mt-1.5 -ml-1.5 h-3 w-3 rounded-full"
                  style={{ background: ['var(--todo)', 'var(--doing)', 'var(--done)'][i] }}
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1.1, ease: [0.6, 0.1, 0.4, 0.9], delay: i * 0.12 }}
                  transformTemplate={({ rotate }) => `rotate(${rotate}) translateX(14px)`}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
