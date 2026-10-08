import { defineConfig } from '@playwright/test'

export default defineConfig({
  testMatch: '*.pw.ts',
  fullyParallel: true,
  projects: [{ name: 'fixture' }],
  reporter: [
    [
      '../../duration-shard-reporter.ts',
      { durations: process.env.PLAYWRIGHT_SHARD_DURATIONS }
    ]
  ]
})
