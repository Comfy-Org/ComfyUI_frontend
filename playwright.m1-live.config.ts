import { execFileSync } from 'node:child_process'

import { defineConfig, devices } from '@playwright/test'

import base from './playwright.config'

export default defineConfig({
  ...base,
  testMatch: '**/tests/liveExecution/**/*.spec.ts',
  testIgnore: [],
  globalSetup: undefined,
  globalTeardown: undefined,
  fullyParallel: false,
  workers: 1,
  repeatEach: 5,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 20_000 },
  outputDir: 'test-results/m1-live',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/m1-live', open: 'never' }],
    ['json', { outputFile: 'playwright-report/m1-live/results.json' }]
  ],
  metadata: {
    nodeVersion: process.version,
    frontendCommit: execFileSync('git', ['rev-parse', 'HEAD'])
      .toString()
      .trim(),
    coreCommit: process.env.M1_CORE_COMMIT || 'unreported',
    backend: process.env.PLAYWRIGHT_SETUP_API_URL || 'http://127.0.0.1:8188',
    mocks: false,
    executionNodes: 'PrimitiveString → ComfySleepNode → PreviewAny',
    cache: 'Start core with --cache-none'
  },
  projects: [{ name: 'chromium-live', use: { ...devices['Desktop Chrome'] } }],
  use: {
    ...base.use,
    trace: 'on',
    video: 'on',
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    }
  }
})
