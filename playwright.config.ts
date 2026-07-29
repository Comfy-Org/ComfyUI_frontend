import type { PlaywrightTestConfig } from '@playwright/test'
import { defineConfig, devices } from '@playwright/test'

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
        trace: 'on-first-retry'
      }
    }

export default defineConfig({
  testDir: './browser_tests',
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
    // parallel main e2e shards. Excluded from `chromium` above so the main
    // job never collects it: per-test cleanup is prompt-scoped now, but the
    // auto-run tier still waits on the WHOLE queue to go quiet before it
    // measures (waitForQueueQuiet, customNodeSuite.ts), which a parallel
    // shard cannot provide.
    {
      name: 'custom-nodes',
      // retain-on-failure (not the repo's on-first-retry): this job is ~40
      // serial tests, so recording overhead is negligible, and a red run
      // needs 6 installed packs + a live backend to reproduce - the trace of
      // the ACTUAL first failing attempt (not a retry) is the debug artifact.
      // OFF under cloud: that env seeds a real Firebase session, and
      // page.evaluate arguments are recorded verbatim in the trace, which CI
      // uploads as a public artifact - a long-lived refresh token would ship
      // with it (browser_tests/fixtures/helpers/smokeAuth.ts).
      use: {
        ...devices['Desktop Chrome'],
        trace:
          process.env.CUSTOM_NODES_ENV === 'cloud' ? 'off' : 'retain-on-failure'
      },
      // Cloud app boots are network-bound (multi-MB /object_info + auth
      // seeding) and can exceed 15s INSIDE fixture setup, before any test
      // body's setTimeout can extend the budget - record run 30408428601
      // lost all 87 tests at exactly 15.1s this way.
      timeout: process.env.CUSTOM_NODES_ENV === 'cloud' ? 60_000 : 15000,
      // No retries on cloud. Every cloud failure so far has been in the
      // beforeEach hook - sign-in plus app boot - which fails identically
      // every attempt, so retries only multiply the wall clock by four
      // (run 30456554768: 272 tests x 4 attempts x 60s). A flake worth a
      // retry is a per-test one; a hook that cannot complete is not.
      retries: process.env.CUSTOM_NODES_ENV === 'cloud' ? 0 : undefined,
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
