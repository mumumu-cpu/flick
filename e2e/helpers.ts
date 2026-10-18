import { expect, type Page } from '@playwright/test'

export async function addMemo(page: Page, text: string) {
  const box = page.getByTestId('composer')
  await box.fill(text)
  await page.getByTestId('submit').click()
  await expect(page.getByTestId('task-text').filter({ hasText: text })).toBeVisible()
}

/** Drag a task card horizontally with the pointer, like a finger flick. */
export async function swipe(page: Page, text: string, dx: number) {
  // Wait out tab-switch exit animations so only the live card matches.
  await expect(page.getByTestId('task').filter({ hasText: text })).toHaveCount(1)
  const card = page.getByTestId('task').filter({ hasText: text }).locator('[role=button]')
  await page.waitForTimeout(150)
  const b = (await card.boundingBox())!
  const y = b.y + b.height / 2
  const x0 = b.x + b.width / 2
  await page.mouse.move(x0, y)
  await page.mouse.down()
  const steps = 12
  for (let i = 1; i <= steps; i++) await page.mouse.move(x0 + (dx * i) / steps, y + i * 0.3)
  await page.mouse.up()
}

export async function devLogin(page: Page, email = `t-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`) {
  const res = await page.request.post('/api/auth/dev', { data: { email } })
  expect(res.ok()).toBeTruthy()
  return email
}

export const count = (page: Page, s: 'todo' | 'doing' | 'done') => page.getByTestId(`count-${s}`)
