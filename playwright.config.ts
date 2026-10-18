import { defineConfig, devices } from '@playwright/test'

const PORT = 5180

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  // Remote runs: fewer parallel browsers so local CPU contention doesn't masquerade as slowness.
  workers: process.env.BASE_URL ? 2 : undefined,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL ?? `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'android-chrome', use: { ...devices['Pixel 7'] } },
    { name: 'iphone-safari', use: { ...devices['iPhone 15'] } },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        // Test the production build running in workerd (same runtime as Cloudflare).
        command: `LOCAL_ONLY=1 npx vite build && LOCAL_ONLY=1 npx vite preview --port ${PORT} --strictPort`,
        port: PORT,
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
