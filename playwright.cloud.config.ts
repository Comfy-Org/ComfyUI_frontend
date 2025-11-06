import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for cloud E2E tests.
 * Tests run against stagingcloud.comfy.org with authenticated user.
 */
export default defineConfig({
  testDir: './browser_tests/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: 'html',

  // Cloud tests need more time due to network latency
  timeout: 75000, // 5x the default 15000ms
  retries: process.env.CI ? 2 : 0,

  use: {
    trace: 'on-first-retry',
    // Cloud URL - can override with PLAYWRIGHT_TEST_URL env var
    baseURL: process.env.PLAYWRIGHT_TEST_URL || 'https://stagingcloud.comfy.org'
  },

  // Authenticate once before all tests
  globalSetup: './browser_tests/globalSetupCloud.ts',

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      timeout: 75000,
      grep: /@cloud/ // Only run tests tagged with @cloud
    }
  ]
})
