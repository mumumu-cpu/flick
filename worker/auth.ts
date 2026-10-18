import { Hono, type Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { User } from '../shared/types'
import type { AppEnv } from './env'

const SESSION_COOKIE = 'flick_sid'
const OAUTH_COOKIE = 'flick_oauth'
const SESSION_TTL = 60 * 60 * 24 * 60 // 60 days, sliding

const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

const randomToken = (bytes = 32) => b64url(crypto.getRandomValues(new Uint8Array(bytes)))

const sha256 = async (s: string) =>
  b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))

const secure = (url: string) => new URL(url).protocol === 'https:'

export async function getSessionUser(c: { env: AppEnv['Bindings']; req: { raw: Request } }, token?: string) {
  if (!token) return null
  const row = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.picture, s.expires_at FROM sessions s
     JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?`,
  )
    .bind(await sha256(token), Date.now())
    .first<User & { expires_at: number }>()
  if (!row) return null
  const { expires_at, ...user } = row
  return { user, expires_at }
}

async function createSession(c: Context<AppEnv>, user: User) {
  await c.env.DB.prepare(
    `INSERT INTO users (id, email, name, picture, created_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET email = excluded.email, name = excluded.name, picture = excluded.picture`,
  )
    .bind(user.id, user.email, user.name, user.picture, Date.now())
    .run()
  const token = randomToken()
  await c.env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(await sha256(token), user.id, Date.now() + SESSION_TTL * 1000)
    .run()
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: secure(c.req.url),
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_TTL,
  })
}

export const sessionCookie = SESSION_COOKIE
export const refreshSession = async (env: AppEnv['Bindings'], token: string) =>
  env.DB.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?')
    .bind(Date.now() + SESSION_TTL * 1000, await sha256(token))
    .run()

export const auth = new Hono<AppEnv>()

auth.get('/google', async (c) => {
  const state = randomToken(16)
  const verifier = randomToken(48)
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
  const redirectUri = new URL('/api/auth/callback', c.req.url).toString()
  setCookie(c, OAUTH_COOKIE, `${state}.${verifier}`, {
    httpOnly: true,
    secure: secure(c.req.url),
    sameSite: 'Lax',
    path: '/api/auth',
    maxAge: 600,
  })
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.search = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString()
  return c.redirect(url.toString())
})

auth.get('/callback', async (c) => {
  const [state, verifier] = (getCookie(c, OAUTH_COOKIE) ?? '').split('.')
  deleteCookie(c, OAUTH_COOKIE, { path: '/api/auth' })
  const code = c.req.query('code')
  if (!code || !state || state !== c.req.query('state')) return c.redirect('/?auth=failed')

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: new URL('/api/auth/callback', c.req.url).toString(),
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  })
  if (!res.ok) return c.redirect('/?auth=failed')
  const { id_token } = await res.json<{ id_token: string }>()
  // The ID token comes straight from Google's token endpoint over TLS, so its claims can be trusted
  // without re-verifying the signature (OIDC Core 3.1.3.7).
  const claims = JSON.parse(
    new TextDecoder().decode(
      Uint8Array.from(atob(id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')), (ch) => ch.charCodeAt(0)),
    ),
  ) as { sub: string; email: string; email_verified: boolean; name?: string; picture?: string; aud: string }
  if (claims.aud !== c.env.GOOGLE_CLIENT_ID || !claims.email_verified) return c.redirect('/?auth=failed')

  await createSession(c, {
    id: `google:${claims.sub}`,
    email: claims.email,
    name: claims.name ?? '',
    picture: claims.picture ?? '',
  })
  return c.redirect('/?auth=ok')
})

// Local-only login for E2E tests. DEV_LOGIN is set only in .dev.vars, never in production.
auth.post('/dev', async (c) => {
  if (c.env.DEV_LOGIN !== '1') return c.notFound()
  const { email = 'tester@example.com' } = await c.req.json<{ email?: string }>().catch(() => ({}) as { email?: string })
  await createSession(c, { id: `dev:${email}`, email, name: 'Tester', picture: '' })
  return c.json({ ok: true })
})

auth.post('/logout', async (c) => {
  const token = getCookie(c, SESSION_COOKIE)
  if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run()
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
  return c.json({ ok: true })
})
