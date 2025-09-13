import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './scripts',
  use: {
    baseURL: 'http://localhost:5173',
    headless: true
  },
  reporter: 'list',
  timeout: 60000,
  testMatch: /collect-i18n-.*\.ts/,
  // Run tests sequentially to avoid conflicts
  workers: 1,
  fullyParallel: false,
  // Use combined setup that includes litegraph preprocessing
  globalSetup: './browser_tests/globalSetupWithI18n.ts',
  globalTeardown: './browser_tests/globalTeardownWithI18n.ts'
})
