import { Hono } from 'hono'
import { MAX_TEXT } from '../shared/types'
import type { AppEnv } from './env'

const HOURLY_LIMIT = 60

export const ai = new Hono<AppEnv>()

ai.use(async (c, next) => {
  const user = c.get('user')
  const hourAgo = Date.now() - 3600_000
  const row = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM ai_usage WHERE user_id = ? AND at > ?')
    .bind(user.id, hourAgo)
    .first<{ n: number }>()
  if ((row?.n ?? 0) >= HOURLY_LIMIT) return c.json({ error: 'rate_limited' }, 429)
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO ai_usage (user_id, at) VALUES (?, ?)').bind(user.id, Date.now()),
    c.env.DB.prepare('DELETE FROM ai_usage WHERE user_id = ? AND at <= ?').bind(user.id, hourAgo),
  ])
  await next()
})

async function readText(req: Request) {
  const body = await req.json<{ text?: unknown }>().catch(() => ({}) as { text?: unknown })
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, MAX_TEXT) : ''
  return text
}

// gpt-oss reasons before answering, so the token budget must cover reasoning + JSON.
async function runJson<T>(env: AppEnv['Bindings'], system: string, user: string, schema: object, effort: 'low' | 'medium' = 'low'): Promise<T> {
  const out = (await env.AI.run(env.AI_MODEL as keyof AiModels, {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_schema', json_schema: schema },
    max_tokens: 1500,
    temperature: 0.3,
    reasoning_effort: effort,
  } as never)) as { response?: unknown; choices?: { message?: { content?: unknown } }[] }
  // Models answer either as { response } or in the OpenAI chat.completion shape.
  const r = out.response ?? out.choices?.[0]?.message?.content
  if (r && typeof r === 'object') return r as T
  const s = String(r ?? '').replace(/<think>[\s\S]*?<\/think>/g, '')
  const m = s.match(/\{[\s\S]*\}/)
  return JSON.parse(m ? m[0] : s) as T
}

// Strip list markers and any stray JSON punctuation a model leaves around the text.
const clean = (s: string) =>
  s.replace(/^\s*(?:[-・*•]|\d+[.)])\s*/, '').replace(/[\s'"`,]+$/, '').replace(/^['"`]+/, '').trim().slice(0, 200)

ai.post('/split', async (c) => {
  const text = await readText(c.req.raw)
  if (!text) return c.json({ error: 'empty' }, 400)
  if (c.env.AI_MOCK === '1') return c.json({ items: ['手順1: ' + text, '手順2: ' + text, '手順3: ' + text] })
  const { items } = await runJson<{ items: string[] }>(
    c.env,
    'あなたはタスク分解アシスタントです。ユーザーのメモを、すぐ着手できる具体的なサブタスク3〜6個に分解してください。各サブタスクは簡潔な日本語(40文字以内)、動詞で終える。メモにある期限・日時・場所・人名は関係するサブタスクに残す。メモが日本語以外ならその言語で返す。JSONのみを返す。',
    text,
    { type: 'object', properties: { items: { type: 'array', items: { type: 'string' } } }, required: ['items'] },
    'low',
  )
  const list = (Array.isArray(items) ? items : []).map((s) => clean(String(s))).filter(Boolean).slice(0, 6)
  if (!list.length) return c.json({ error: 'ai_failed' }, 502)
  return c.json({ items: list })
})

ai.post('/polish', async (c) => {
  const text = await readText(c.req.raw)
  if (!text) return c.json({ error: 'empty' }, 400)
  if (c.env.AI_MOCK === '1') return c.json({ text: `${text}を進める` })
  const { title } = await runJson<{ title: string }>(
    c.env,
    'あなたはタスク整理アシスタントです。ユーザーのメモ(音声入力の誤変換やフィラーを含むことがある)を、フィラーや言い淀みを除き、意味を変えずに簡潔で行動可能なタスク名(60文字以内)に整えてください。期限・日時・場所・人名・数量などの情報は必ず残してください。メモが日本語以外ならその言語で返す。JSONのみを返す。',
    text,
    { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] },
    'low',
  )
  const result = clean(String(title ?? ''))
  if (!result) return c.json({ error: 'ai_failed' }, 502)
  return c.json({ text: result })
})
