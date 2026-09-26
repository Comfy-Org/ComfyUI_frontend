import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '../e2e/storybook',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html'], ['list']] : 'list',
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.001 }
  },
  use: {
    baseURL: 'http://localhost:6008',
    ...devices['Desktop Chrome'],
    colorScheme: 'dark',
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'pnpm storybook',
    port: 6008,
    reuseExistingServer: !process.env.CI
  }
})
