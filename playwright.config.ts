import type { PlaywrightTestConfig } from '@playwright/test'
import { defineConfig, devices } from '@playwright/test'

const distribution = process.env.DISTRIBUTION
Object.assign(globalThis, {
  __DISTRIBUTION__:
    distribution === 'desktop' ||
    distribution === 'localhost' ||
    distribution === 'cloud'
      ? distribution
      : process.env.DEV_SERVER_COMFYUI_URL?.includes('.comfy.org')
        ? 'cloud'
        : 'localhost',
  __IS_NIGHTLY__: process.env.IS_NIGHTLY === 'true'
})

const maybeLocalOptions: PlaywrightTestConfig = process.env.PLAYWRIGHT_LOCAL
  ? {
      timeout: 30_000,
      retries: 0,
      workers: 1,
      use: {
        trace: 'on',
        video: 'on',
        launchOptions: {
          slowMo: Number(process.env.SLOW_MO) || 0
        }
      }
    }
  : {
      retries: process.env.CI ? 3 : 0,
      workers: process.env.CI ? 2 : undefined,
      use: {
        trace: 'on-first-retry',
        video: process.env.RECORD_VIDEO === 'true' ? 'on' : undefined,
        launchOptions: {
          slowMo: Number(process.env.SLOW_MO) || 0
        }
      }
    }

export default defineConfig({
  testDir: './browser_tests',
  testIgnore: [
    '**/*.test.ts',
    // Untransformed recorder output — still bare codegen, not a runnable spec
    '**/*.raw.spec.ts',
    // The recorder's scratch spec calls page.pause(), so collecting it outside
    // a recording session hangs the suite. comfy-test opts back in.
    ...(process.env.COMFY_TEST_RECORDING
      ? []
      : ['**/_recording-session.spec.ts'])
  ],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.PLAYWRIGHT_BLOB_OUTPUT_DIR ? 'blob' : 'html',
  ...maybeLocalOptions,

  globalSetup: './browser_tests/globalSetup.ts',
  globalTeardown: './browser_tests/globalTeardown.ts',

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      timeout: 15000,
      grepInvert: /@mobile|@perf|@audit|@cloud|@custom-nodes/
    },

    // The custom-node suite needs the manifest packs installed and a quiet
    // backend queue, so it runs in its own gating job
    // (ci-tests-custom-nodes.yaml) with --workers=1, not alongside the
    // parallel main e2e shards: the auto-run tier waits on the WHOLE queue
    // to go quiet before it measures, which a parallel shard cannot provide.
    // retain-on-failure trace: ~40 serial tests, negligible overhead, and a
    // red run needs 6 installed packs + a live backend to reproduce.
    {
      name: 'custom-nodes',
      use: {
        ...devices['Desktop Chrome'],
        trace: 'retain-on-failure'
      },
      timeout: 15000,
      grep: /@custom-nodes/,
      fullyParallel: false
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
      grepInvert: /@oss|@mobile-ios/
    },

    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'], hasTouch: true },
      grep: /@mobile\b/,
      grepInvert: /@mobile-ios/
    },

    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 15'] },
      grep: /@mobile-ios/
    }
  ]
})
