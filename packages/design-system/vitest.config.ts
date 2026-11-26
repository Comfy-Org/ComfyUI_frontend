import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
      exclude: ['src/**/*.stories.ts']
    },
    mockReset: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    silent: 'passed-only',
    fakeTimers: { shouldAdvanceTime: true },
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
    globals: true,
    env: { TZ: 'UTC' },
    setupFiles: [
      '../../vitest.console.setup.ts',
      '../../vitest.network.setup.ts',
      '../../vitest.timer.setup.ts',
      './vitest.setup.ts'
    ]
  }
})
