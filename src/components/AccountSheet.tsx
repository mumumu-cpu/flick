import { motion } from 'motion/react'
import type { User } from '../../shared/types'
import { GoogleG } from './icons'
import { Sheet } from './Sheet'

interface Props {
  open: boolean
  user: User | null
  syncing: boolean
  onClose: () => void
  onLogin: () => void
  onLogout: () => void
}

export function AccountSheet({ open, user, syncing, onClose, onLogin, onLogout }: Props) {
  return (
    <Sheet open={open} onClose={onClose} label="アカウント">
      <div className="pt-1 pb-2">
        {user ? (
          <>
            <div className="flex items-center gap-3 px-1">
              <Avatar user={user} size={48} />
              <div className="min-w-0">
                <p className="truncate text-[17px] font-semibold" data-testid="account-name">{user.name || user.email}</p>
                <p className="truncate text-[13.5px] text-[var(--ink-3)]">{user.email}</p>
              </div>
              <span className="ml-auto text-[12px] text-[var(--ink-3)]">{syncing ? '同期中' : '同期済み'}</span>
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onLogout}
              data-testid="logout"
              className="chip mt-5 h-[52px] w-full rounded-[18px] text-[16px] font-semibold text-[var(--danger)]"
            >
              ログアウト
            </motion.button>
          </>
        ) : (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onLogin}
            data-testid="login-google"
            className="flex h-[54px] w-full items-center justify-center gap-3 rounded-[18px] bg-white text-[16px] font-semibold shadow-[0_6px_20px_-8px_rgba(28,40,90,.35),inset_0_0_0_1px_rgba(13,16,23,.08)]"
          >
            <GoogleG />
            Googleで続ける
          </motion.button>
        )}
      </div>
    </Sheet>
  )
}

export function Avatar({ user, size = 32 }: { user: User; size?: number }) {
  const initial = (user.name || user.email).slice(0, 1).toUpperCase()
  return user.picture ? (
    <img src={user.picture} alt="" width={size} height={size} referrerPolicy="no-referrer" className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="grid place-items-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.42, background: 'linear-gradient(140deg,#60a5fa,#a78bfa)' }}
    >
      {initial}
    </span>
  )
}
