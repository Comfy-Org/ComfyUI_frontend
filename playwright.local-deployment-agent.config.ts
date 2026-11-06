import { defineConfig, devices } from '@playwright/test'
import { config as dotenvConfig } from 'dotenv'

dotenvConfig()

Object.assign(globalThis, {
  __DISTRIBUTION__: 'localhost',
  __IS_NIGHTLY__: process.env.IS_NIGHTLY === 'true'
})

export default defineConfig({
  testDir: './browser_tests/tests/liveLocalAgent',
  outputDir: './test-results/local-deployment-agent',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  workers: 1,
  retries: 0,
  timeout: 300_000,
  expect: { timeout: 30_000 },
  reporter: [
    ['list'],
    [
      'html',
      {
        outputFolder: 'playwright-report/local-deployment-agent',
        open: 'never'
      }
    ]
  ],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.PLAYWRIGHT_TEST_URL,
    storageState: process.env.OPEN_ON_CLOUD_AUTH_STATE,
    headless: process.env.OPEN_ON_CLOUD_INTERACTIVE_LOGIN !== '1',
    locale: 'en-US',
    trace: 'off',
    video: 'off',
    screenshot: 'off'
  },
  projects: [{ name: 'local-deployment-agent' }]
})
