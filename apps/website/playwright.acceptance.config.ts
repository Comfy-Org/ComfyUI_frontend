import { defineConfig, devices } from '@playwright/test'
import { z } from 'zod'

const scope = z
  .enum(['smoke', 'release', 'checkout'])
  .parse(process.env.WORKSHOP_ACCEPTANCE_SCOPE ?? 'smoke')

export default defineConfig({
  testDir: './e2e/acceptance',
  testMatch: scope === 'checkout' ? 'purchase.spec.ts' : 'generation.spec.ts',
  grep: scope === 'smoke' ? /@smoke/ : undefined,
  globalSetup: './acceptance/setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 135 * 60_000,
  globalTimeout: 315 * 60_000,
  expect: { timeout: 30_000 },
  outputDir: './acceptance-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'acceptance-report', open: 'never' }],
    ['junit', { outputFile: 'acceptance-results/junit.xml' }]
  ],
  use: {
    baseURL: process.env.WORKSHOP_SITE_URL,
    trace: 'off',
    video: 'off',
    screenshot: 'off',
    acceptDownloads: true,
    locale: 'en-US',
    serviceWorkers: 'block'
  },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'webkit', use: devices['Desktop Safari'] },
    { name: 'mobile-chrome', use: devices['Pixel 5'] },
    { name: 'mobile-safari', use: devices['iPhone 15'] }
  ]
})
