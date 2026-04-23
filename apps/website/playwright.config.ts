import type { PlaywrightTestConfig } from '@playwright/test'
import { defineConfig, devices } from '@playwright/test'

const maybeLocalOptions: PlaywrightTestConfig = process.env.PLAYWRIGHT_LOCAL
  ? {
      timeout: 30_000,
      retries: 0,
      workers: 1,
      use: {
        baseURL: 'http://localhost:4321',
        trace: 'on',
        video: 'on'
      }
    }
  : {
      retries: process.env.CI ? 2 : 0,
      use: {
        baseURL: 'http://localhost:4321',
        trace: 'on-first-retry'
      }
    }

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI
    ? [['html'], ['json', { outputFile: 'results.json' }]]
    : 'html',
  expect: {
    toHaveScreenshot: { maxDiffPixels: 50 }
  },
  ...maybeLocalOptions,
  webServer: {
    command: 'pnpm preview',
    port: 4321,
    reuseExistingServer: !process.env.CI
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
      grepInvert: /@mobile|@visual/
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'] },
      grep: /@mobile/
    },
    {
      name: 'visual',
      use: { ...devices['Desktop Chrome'] },
      grep: /@visual/,
      fullyParallel: false
    }
  ]
})
