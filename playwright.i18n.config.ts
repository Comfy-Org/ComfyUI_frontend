import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './scripts/i18n',
  use: {
    baseURL: 'http://localhost:5173',
    headless: true
  },
  reporter: 'list',
  timeout: 60000,
  testMatch: /collect-i18n-.*\.ts/
  // Don't use globalSetup/globalTeardown to avoid ComfyUI path dependencies
})
