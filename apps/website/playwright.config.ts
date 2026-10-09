import type {
  PlaywrightTestConfig,
  ReporterDescription
} from '@playwright/test'
import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.WEBSITE_E2E_PORT ?? 4321)
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('WEBSITE_E2E_PORT must be an integer from 1 to 65535')
const baseURL = `http://localhost:${port}`

const maybeLocalOptions: PlaywrightTestConfig = process.env.PLAYWRIGHT_LOCAL
  ? {
      timeout: 30_000,
      retries: 0,
      workers: 1,
      use: {
        baseURL,
        trace: 'on',
        video: 'on'
      }
    }
  : {
      retries: process.env.CI ? 2 : 0,
      use: {
        baseURL,
        trace: 'on-first-retry'
      }
    }

// CI harvests the actual image of every failed screenshot assertion so the
// screenshot-update workflow can commit them without rerunning the suite.
const snapshotUpdatesDir = process.env.PLAYWRIGHT_SNAPSHOT_UPDATES_DIR
const reporters: ReporterDescription[] = [
  ...(process.env.PLAYWRIGHT_BLOB_OUTPUT_DIR
    ? [['blob'] satisfies ReporterDescription]
    : process.env.CI
      ? ([
          ['list'],
          ['html'],
          ['json', { outputFile: 'results.json' }]
        ] satisfies ReporterDescription[])
      : [['html'] satisfies ReporterDescription]),
  ...(snapshotUpdatesDir
    ? [
        [
          '../../scripts/playwright/snapshotUpdatesReporter.ts',
          { outputDir: snapshotUpdatesDir }
        ] satisfies ReporterDescription
      ]
    : [])
]

export default defineConfig({
  testDir: './e2e',
  testIgnore: '**/acceptance/**',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  globalTimeout: process.env.CI ? 20 * 60_000 : 0,
  reporter: reporters,
  expect: {
    toHaveScreenshot: { maxDiffPixels: 100 }
  },
  ...maybeLocalOptions,
  webServer: {
    command: `pnpm preview --port ${port}`,
    port,
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
