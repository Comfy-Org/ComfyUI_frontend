import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './scripts',
  reporter: 'list',
  timeout: 60000,
  testMatch: /collect-i18n-.*\.ts/,
  // Run tests sequentially to avoid conflicts
  workers: 1,
  fullyParallel: false,
  // Use regular setup without babel preprocessing
  globalSetup: './browser_tests/globalSetup.ts',
  globalTeardown: './browser_tests/globalTeardown.ts'
})
