import { expect, test } from '@playwright/test'
import { addMemo, count, devLogin, swipe } from './helpers'

test.describe('メモ', () => {
  test('開いた瞬間にメモ欄がフォーカスされ、JS読み込み前の入力も引き継がれる', async ({ page }) => {
    // Hold back the app bundle so we can type into the boot shell first.
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    await page.route(/\/(src\/main\.tsx|assets\/index-[^/]+\.js)/, async (route) => {
      await gate
      await route.continue()
    })
    // Module scripts hold back DOMContentLoaded, so only wait for the HTML to commit.
    await page.goto('/', { waitUntil: 'commit' })
    const boot = page.locator('#boot-memo')
    await expect(boot).toBeFocused()
    await page.keyboard.type('起動中に書いたメモ')
    release()
    const composer = page.getByTestId('composer')
    await expect(composer).toHaveValue('起動中に書いたメモ')
    await expect(page.locator('#boot')).toHaveCount(0)
    await expect(composer).toBeFocused()
  })

  test('Enter とボタンで追加でき、IME変換中の Enter では追加されない', async ({ page }) => {
    await page.goto('/')
    const box = page.getByTestId('composer')
    await box.fill('変換中')
    await box.evaluate((el) => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, isComposing: true, keyCode: 229 })))
    await expect(box).toHaveValue('変換中')
    await box.press('Enter')
    await expect(page.getByTestId('task-text').filter({ hasText: '変換中' })).toBeVisible()
    await expect(box).toHaveValue('')
    await addMemo(page, 'ボタンで追加')
    await expect(count(page, 'todo')).toHaveText('2')
    // newest first
    await expect(page.getByTestId('task-text').first()).toHaveText('ボタンで追加')
  })

  test('下書きはリロードしても残り、タスクはローカルに保存される', async ({ page }) => {
    await page.goto('/')
    await addMemo(page, '保存されるタスク')
    await page.getByTestId('composer').fill('書きかけ')
    await page.reload()
    await expect(page.getByTestId('composer')).toHaveValue('書きかけ')
    await expect(page.getByTestId('task-text').filter({ hasText: '保存されるタスク' })).toBeVisible()
  })
})

test.describe('フリックでステータス管理', () => {
  test('右フリックで 未着手→進行中→完了、左フリックで戻る', async ({ page }) => {
    await page.goto('/')
    await addMemo(page, 'フリック対象')
    await swipe(page, 'フリック対象', 220)
    await expect(count(page, 'doing')).toHaveText('1')
    await expect(count(page, 'todo')).toHaveText('0')
    await expect(page.getByTestId('empty')).toBeVisible()

    await page.getByTestId('tab-doing').click()
    await expect(page.getByRole('heading', { name: /進行中/ })).toBeVisible()
    await swipe(page, 'フリック対象', 220)
    await expect(count(page, 'done')).toHaveText('1')

    await page.getByTestId('tab-done').click()
    const done = page.getByTestId('task').filter({ hasText: 'フリック対象' })
    await expect(done).toHaveCount(1)
    await expect(done).toHaveAttribute('data-status', 'done')
    await swipe(page, 'フリック対象', -220)
    await expect(count(page, 'doing')).toHaveText('1')
    await expect(count(page, 'done')).toHaveText('0')
  })

  test('短いドラッグでは動かない（誤操作防止）', async ({ page }) => {
    await page.goto('/')
    await addMemo(page, 'ちょっとだけ')
    await swipe(page, 'ちょっとだけ', 40)
    await page.waitForTimeout(400)
    await expect(count(page, 'todo')).toHaveText('1')
    await expect(page.getByTestId('task').filter({ hasText: 'ちょっとだけ' })).toBeVisible()
  })

  test('未着手で左フリックすると削除、元に戻すで復元', async ({ page }) => {
    await page.goto('/')
    await addMemo(page, '消すタスク')
    await swipe(page, '消すタスク', -220)
    await expect(page.getByTestId('toast')).toContainText('削除しました')
    await expect(page.getByTestId('task').filter({ hasText: '消すタスク' })).toHaveCount(0)
    await page.getByTestId('undo').click()
    await expect(page.getByTestId('task').filter({ hasText: '消すタスク' })).toBeVisible()
  })

  test('移動直後の「元に戻す」で前のステータスに戻る', async ({ page }) => {
    await page.goto('/')
    await addMemo(page, '戻すタスク')
    await swipe(page, '戻すタスク', 220)
    await expect(count(page, 'doing')).toHaveText('1')
    await page.getByTestId('undo').click()
    await expect(count(page, 'todo')).toHaveText('1')
    await expect(count(page, 'doing')).toHaveText('0')
  })
})

test.describe('編集シート', () => {
  test('タップで開き、編集・ステータス変更・削除ができる', async ({ page }) => {
    await page.goto('/')
    await addMemo(page, '編集前')
    await page.getByTestId('task').filter({ hasText: '編集前' }).locator('[role=button]').click()
    const sheet = page.getByRole('dialog', { name: 'タスク' })
    await expect(sheet).toBeVisible()
    await page.getByTestId('sheet-text').fill('編集後')
    await page.getByTestId('sheet-status-doing').click()
    await page.getByTestId('sheet-backdrop').click({ position: { x: 20, y: 20 } })
    await expect(sheet).toBeHidden()
    await expect(count(page, 'doing')).toHaveText('1')
    await page.getByTestId('tab-doing').click()
    await expect(page.getByTestId('task-text').filter({ hasText: '編集後' })).toBeVisible()

    await page.getByTestId('task').filter({ hasText: '編集後' }).locator('[role=button]').click()
    await page.getByTestId('sheet-delete').click()
    await expect(page.getByTestId('toast')).toContainText('削除しました')
    await expect(count(page, 'doing')).toHaveText('0')
  })
})

test.describe('ログインと同期', () => {
  test('未ログインで AI を使うとログインシートが開く', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('composer').fill('AIで分解したい')
    await page.getByTestId('ai-split').click()
    await expect(page.getByRole('dialog', { name: 'アカウント' })).toBeVisible()
    await expect(page.getByTestId('login-google')).toBeVisible()
    await expect(page.getByTestId('toast')).toContainText('ログイン')
  })

  test('Google ログインボタンは PKCE 付きで Google の認可画面へ遷移する', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('account').click()
    let location = ''
    await page.route('**/api/auth/google', async (route) => {
      const res = await route.fetch({ maxRedirects: 0 })
      location = res.headers()['location'] ?? ''
      await route.fulfill({ status: 200, body: 'redirecting' })
    })
    await page.getByTestId('login-google').click()
    await expect.poll(() => location).toContain('https://accounts.google.com/')
    const u = new URL(location)
    expect(u.searchParams.get('code_challenge_method')).toBe('S256')
    expect(u.searchParams.get('scope')).toBe('openid email profile')
    expect(u.searchParams.get('redirect_uri')).toMatch(/\/api\/auth\/callback$/)
    expect(u.searchParams.get('state')).toBeTruthy()
  })

  test('ログイン後は AI 分解・整えるが使え、別端末でも同期される（スケルトン表示あり）', async ({ page, browser }) => {
    await page.goto('/')
    await addMemo(page, 'ログイン前のメモ')
    await devLogin(page)
    await page.reload()
    await expect(page.getByTestId('account').locator('img, span').first()).toBeVisible()

    await page.getByTestId('composer').fill('えーと旅行の準備')
    await page.getByTestId('ai-polish').click()
    await expect(page.getByTestId('composer')).not.toHaveValue('えーと旅行の準備')
    await expect(page.getByTestId('composer')).not.toHaveValue('')

    await page.getByTestId('composer').fill('引っ越し')
    await page.getByTestId('ai-split').click()
    await expect(page.getByTestId('toast')).toContainText('件に分解しました')
    await expect(page.getByTestId('composer')).toHaveValue('')
    const n = await page.getByTestId('task').count()
    expect(n).toBeGreaterThanOrEqual(4)

    // Wait for the push to finish.
    await expect
      .poll(async () => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('flick:dirty') || '{}')).length))
      .toBe(0)

    // Second device: same account cookie, empty storage.
    const ctx2 = await browser.newContext({ ...test.info().project.use, storageState: { cookies: await page.context().cookies(), origins: [] } })
    const p2 = await ctx2.newPage()
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    await p2.route('**/api/sync', async (route) => {
      await gate
      await route.continue()
    })
    await p2.goto('/')
    // Cached user is unknown on a new device until /api/me answers; then the skeleton shows while syncing.
    await expect(p2.getByTestId('skeleton')).toBeVisible()
    release()
    await expect(p2.getByTestId('skeleton')).toBeHidden()
    await expect(p2.getByTestId('task')).toHaveCount(n)
    await expect(p2.getByTestId('task-text').filter({ hasText: 'ログイン前のメモ' })).toBeVisible()

    // A flick on device 2 shows up on device 1.
    await swipe(p2, 'ログイン前のメモ', 220)
    await expect(count(p2, 'doing')).toHaveText('1')
    await expect
      .poll(async () => p2.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('flick:dirty') || '{}')).length))
      .toBe(0)
    await page.reload()
    await expect(count(page, 'doing')).toHaveText('1')
    await ctx2.close()
  })

  test('ログアウトで全画面ローダーが出て、端末のデータが消える', async ({ page }) => {
    await devLogin(page)
    await page.goto('/')
    await addMemo(page, 'ログアウトで消える')
    await page.getByTestId('account').click()
    await expect(page.getByTestId('account-name')).toBeVisible()
    await page.getByTestId('logout').click()
    await expect(page.getByTestId('fullscreen-loader')).toBeHidden()
    await expect(page.getByTestId('task')).toHaveCount(0)
    const me = await page.request.get('/api/me')
    expect((await me.json()).user).toBeNull()
  })
})

test.describe('API の防御', () => {
  test('未認証の同期・AI は 401、別オリジンからの POST は 403', async ({ request, baseURL }) => {
    expect((await request.post('/api/sync', { data: { changes: [] } })).status()).toBe(401)
    expect((await request.post('/api/ai/split', { data: { text: 'x' } })).status()).toBe(401)
    expect((await request.post('/api/auth/logout', { headers: { origin: 'https://evil.example' } })).status()).toBe(403)
    expect((await request.get('/api/nope')).status()).toBe(404)
    expect(baseURL).toBeTruthy()
  })

  test('他人のタスクは見えない', async ({ browser }) => {
    const a = await browser.newContext()
    const pa = await a.newPage()
    await pa.goto('/')
    await devLogin(pa)
    const now = Date.now()
    await pa.request.post('/api/sync', {
      data: { changes: [{ id: 'secret-1', text: 'Aの秘密', status: 'todo', position: now, created_at: now, updated_at: now }] },
    })
    const b = await browser.newContext()
    const pb = await b.newPage()
    await pb.goto('/')
    await devLogin(pb)
    const res = await pb.request.post('/api/sync', {
      data: { changes: [{ id: 'secret-1', text: '上書き', status: 'done', position: now, created_at: now, updated_at: now + 1 }] },
    })
    const { tasks } = await res.json()
    expect(tasks.map((t: { text: string }) => t.text)).toEqual(['上書き'])
    const again = await (await pa.request.post('/api/sync', { data: { changes: [] } })).json()
    expect(again.tasks[0].text).toBe('Aの秘密')
    await a.close()
    await b.close()
  })
})

test.describe('画面', () => {
  test('横スクロールが発生せず、コンソールエラーが無い', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    await page.goto('/')
    await addMemo(page, 'とても長いタスク名'.repeat(20))
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    await expect(page.getByTestId('tab-todo')).toBeInViewport()
    expect(errors).toEqual([])
  })
})
