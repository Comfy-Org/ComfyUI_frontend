import { defineConfig, devices } from '@playwright/test'

import base from './playwright.config'

export default defineConfig({
  ...base,
  testMatch: '**/tests/vueNodes/widgets/nativeLoraStack.spec.ts',
  testIgnore: [],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'playwright-report/report.json' }]
  ],
  use: { ...base.use, video: 'on', trace: 'retain-on-failure' },
  projects: [{ name: 'native-lora', use: devices['Desktop Chrome'] }]
})
