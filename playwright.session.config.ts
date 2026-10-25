import { defineConfig, devices } from '@playwright/test'
import { config as dotenvConfig } from 'dotenv'

import type { CrossOriginSessionOptions } from './browser_tests/fixtures/utils/crossOriginSessionConfig'

dotenvConfig()

export default defineConfig<CrossOriginSessionOptions>({
  testDir: './browser_tests/tests/crossOriginSession',
  outputDir: './test-results/session',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/session', open: 'never' }]
  ],
  use: {
    ...devices['Desktop Chrome'],
    locale: 'en-US',
    trace: 'retain-on-failure',
    video: 'off',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'session-flag-off',
      grep: /@flag-off/,
      use: { unifiedWebSession: false }
    },
    {
      name: 'session-flag-on',
      grep: /@flag-on/,
      use: { unifiedWebSession: true }
    }
  ]
})
