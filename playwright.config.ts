import type { PlaywrightTestConfig } from '@playwright/test'
import { defineConfig, devices } from '@playwright/test'

const maybeLocalOptions: PlaywrightTestConfig = process.env.PLAYWRIGHT_LOCAL
  ? {
      timeout: 30_000,
      retries: 0,
      workers: 1,
      use: {
        trace: 'on',
        video: 'on'
      }
    }
  : {
      retries: process.env.CI ? 3 : 0,
      use: {
        trace: 'on-first-retry'
      }
    }

export default defineConfig({
  testDir: './browser_tests',
  testMatch: ['tests/**/*.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: 'html',
  ...maybeLocalOptions,

  globalSetup: './browser_tests/globalSetup.ts',
  globalTeardown: './browser_tests/globalTeardown.ts',

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      timeout: 15000,
      grepInvert: /@mobile|@perf|@audit|@cloud/
    },

    {
      name: 'performance',
      use: {
        ...devices['Desktop Chrome'],
        trace: 'retain-on-failure'
      },
      timeout: 60_000,
      grep: /@perf/,
      fullyParallel: false
    },

    {
      name: 'audit',
      use: {
        ...devices['Desktop Chrome'],
        trace: 'retain-on-failure'
      },
      timeout: 120_000,
      grep: /@audit/,
      fullyParallel: false
    },

    {
      name: 'chromium-2x',
      use: { ...devices['Desktop Chrome'], deviceScaleFactor: 2 },
      timeout: 15000,
      grep: /@2x/
    },

    {
      name: 'chromium-0.5x',
      use: { ...devices['Desktop Chrome'], deviceScaleFactor: 0.5 },
      timeout: 15000,
      grep: /@0.5x/
    },

    {
      name: 'cloud',
      use: { ...devices['Desktop Chrome'] },
      timeout: 15000,
      grep: /@cloud/,
      grepInvert: /@oss/
    },

    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'], hasTouch: true },
      grep: /@mobile/
    }
  ]
})
