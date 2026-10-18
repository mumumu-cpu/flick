import { Hono, type MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { MAX_TEXT, STATUSES, type Task } from '../shared/types'
import { ai } from './ai'
import { auth, getSessionUser, refreshSession, sessionCookie } from './auth'
import type { AppEnv } from './env'

const app = new Hono<AppEnv>().basePath('/api')

app.use(async (c, next) => {
  await next()
  c.header('Cache-Control', 'no-store')
  c.header('X-Content-Type-Options', 'nosniff')
})

// Reject cross-site state changes (cookies are SameSite=Lax, this is a second line of defense).
app.use(async (c, next) => {
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
    const origin = c.req.header('origin')
    if (origin && origin !== new URL(c.req.url).origin) return c.json({ error: 'bad_origin' }, 403)
  }
  await next()
})

app.route('/auth', auth)

app.get('/me', async (c) => {
  const token = getCookie(c, sessionCookie)
  const s = await getSessionUser(c, token)
  if (!s) return c.json({ user: null })
  // Slide the expiry at most once a day.
  if (token && s.expires_at - Date.now() < 59 * 86400_000) c.executionCtx.waitUntil(refreshSession(c.env, token))
  return c.json({ user: s.user })
})

const authed = new Hono<AppEnv>()
const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const s = await getSessionUser(c, getCookie(c, sessionCookie))
  if (!s) return c.json({ error: 'unauthorized' }, 401)
  c.set('user', s.user)
  await next()
}
authed.use('/sync', requireUser)
authed.use('/ai/*', requireUser)

const isTask = (t: unknown): t is Task => {
  const x = t as Task
  return (
    !!x &&
    typeof x.id === 'string' &&
    x.id.length > 0 &&
    x.id.length <= 64 &&
    typeof x.text === 'string' &&
    STATUSES.includes(x.status) &&
    Number.isFinite(x.position) &&
    Number.isFinite(x.created_at) &&
    Number.isFinite(x.updated_at)
  )
}

// Push local changes (last-write-wins by updated_at), pull the full list back.
authed.post('/sync', async (c) => {
  const user = c.get('user')
  const body = await c.req.json<{ changes?: unknown[] }>().catch(() => ({}) as { changes?: unknown[] })
  const changes = (Array.isArray(body.changes) ? body.changes : []).filter(isTask).slice(0, 500)
  if (changes.length) {
    const stmt = c.env.DB.prepare(
      `INSERT INTO tasks (id, user_id, text, status, position, created_at, updated_at, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, id) DO UPDATE SET text = excluded.text, status = excluded.status,
         position = excluded.position, updated_at = excluded.updated_at, deleted = excluded.deleted
       WHERE excluded.updated_at > tasks.updated_at`,
    )
    await c.env.DB.batch(
      changes.map((t) =>
        stmt.bind(t.id, user.id, t.text.slice(0, MAX_TEXT), t.status, t.position, t.created_at, t.updated_at, t.deleted ? 1 : 0),
      ),
    )
  }
  const { results } = await c.env.DB.prepare(
    'SELECT id, text, status, position, created_at, updated_at FROM tasks WHERE user_id = ? AND deleted = 0 ORDER BY position DESC',
  )
    .bind(user.id)
    .all<Task>()
  return c.json({ tasks: results })
})

authed.route('/ai', ai)
app.route('/', authed)

app.notFound((c) => c.json({ error: 'not_found' }, 404))
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'server_error' }, 500)
})

export default app
