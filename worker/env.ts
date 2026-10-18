import type { User } from '../shared/types'

export interface AppEnv {
  Bindings: {
    DB: D1Database
    AI: Ai
    AI_MODEL: string
    GOOGLE_CLIENT_ID: string
    GOOGLE_CLIENT_SECRET: string
    DEV_LOGIN?: string
    AI_MOCK?: string
  }
  Variables: { user: User }
}
