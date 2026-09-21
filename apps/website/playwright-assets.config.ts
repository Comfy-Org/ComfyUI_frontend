import { defineConfig, devices } from '@playwright/test'

import base from './playwright.config'

// Run against a build with PUBLIC_WORKSHOP_SAVE_ASSETS=1. The normal browser
// suite also covers the legacy behavior while the rollout flag remains off.
export default defineConfig(base, {
  testDir: './e2e-assets',
  reporter: 'list',
  projects: [{ name: 'desktop', use: devices['Desktop Chrome'] }]
})
