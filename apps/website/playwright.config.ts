import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  expect: {
    toHaveScreenshot: { maxDiffPixels: 50 }
  },
  use: {
    baseURL: 'http://localhost:4321',
    trace: process.env.CI ? 'on-first-retry' : 'on'
  },
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
