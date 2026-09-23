import { fileURLToPath } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

const TEST_SYSTEM_TIME = Date.parse('2024-06-15T12:00:00Z')

const timerSetup = fileURLToPath(
  new URL('../../vitest.timer.setup.ts', import.meta.url)
)

export default defineConfig({
  plugins: [vue()],
  test: {
    name: 'account-ui',
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
    include: ['src/**/*.{test,spec}.ts'],
    mockReset: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    fakeTimers: { now: TEST_SYSTEM_TIME, shouldAdvanceTime: true },
    globals: true,
    env: { TZ: 'UTC' },
    setupFiles: [timerSetup],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**']
    }
  }
})
