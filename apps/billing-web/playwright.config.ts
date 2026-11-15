import type { PlaywrightTestConfig } from '@playwright/test'
import { defineConfig, devices } from '@playwright/test'

import { E2E_ORIGIN, E2E_PORT, E2E_VITE_ENV } from './e2e/fixtures/env'

const maybeLocalOptions: PlaywrightTestConfig = process.env.PLAYWRIGHT_LOCAL
  ? {
      timeout: 30_000,
      retries: 0,
      workers: 1,
      use: { trace: 'on', video: 'on' }
    }
  : {
      retries: process.env.CI ? 2 : 0,
      use: { trace: 'on-first-retry' }
    }

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.PLAYWRIGHT_BLOB_OUTPUT_DIR
    ? 'blob'
    : process.env.CI
      ? [['list'], ['html', { open: 'never' }]]
      : 'html',
  ...maybeLocalOptions,
  use: {
    ...maybeLocalOptions.use,
    baseURL: E2E_ORIGIN
  },
  // A production build, served statically: what a preview deployment runs,
  // built with the suite's own deployment variables rather than a local .env.
  webServer: {
    command: `pnpm exec vite build --logLevel error && pnpm exec vite preview --port ${E2E_PORT} --strictPort`,
    url: E2E_ORIGIN,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: E2E_VITE_ENV
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
})
