import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const TEST_SYSTEM_TIME = Date.parse('2024-06-15T12:00:00Z')

const consoleSetup = fileURLToPath(
  new URL('../../vitest.console.setup.ts', import.meta.url)
)
const networkSetup = fileURLToPath(
  new URL('../../vitest.network.setup.ts', import.meta.url)
)
const timerSetup = fileURLToPath(
  new URL('../../vitest.timer.setup.ts', import.meta.url)
)

const sharedTest = {
  mockReset: true,
  restoreMocks: true,
  unstubEnvs: true,
  unstubGlobals: true,
  silent: 'passed-only',
  fakeTimers: { now: TEST_SYSTEM_TIME, shouldAdvanceTime: true },
  globals: true,
  env: { TZ: 'UTC' },
  setupFiles: [consoleSetup, networkSetup, timerSetup]
} as const

export default defineConfig({
  test: {
    fsModuleCache: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**']
    },
    projects: [
      {
        test: {
          ...sharedTest,
          name: 'account-core',
          environment: 'node',
          include: [
            'src/core/**/*.{test,spec}.ts',
            'src/web/**/*.{test,spec}.ts',
            'src/*.{test,spec}.ts',
            'scripts/*.{test,spec}.ts'
          ]
        }
      },
      {
        test: {
          ...sharedTest,
          name: 'account-firebase',
          environment: 'happy-dom',
          environmentOptions: {
            happyDOM: {
              settings: {
                disableIframePageLoading: true,
                disableCSSFileLoading: true,
                disableJavaScriptFileLoading: true
              }
            }
          },
          include: ['src/firebase/**/*.{test,spec}.ts']
        }
      }
    ]
  }
})
