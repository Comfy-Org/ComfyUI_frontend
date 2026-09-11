import { defineConfig, devices } from '@playwright/test'

Object.assign(globalThis, {
  __DISTRIBUTION__: 'cloud',
  __IS_NIGHTLY__: false
})

export default defineConfig({
  testDir: './browser_tests/tests/liveCloud',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    locale: 'en-US',
    trace: 'off',
    screenshot: 'off',
    video: 'off'
  }
})
