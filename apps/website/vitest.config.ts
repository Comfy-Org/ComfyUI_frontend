import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    mockReset: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    fakeTimers: { shouldAdvanceTime: true },
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts', 'scripts/**/*.{test,spec}.ts'],
    globals: false,
    setupFiles: ['../../vitest.timer.setup.ts', './src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      // Include untested files so patch coverage counts them as 0%.
      include: ['src/**/*.{ts,vue}'],
      exclude: [
        'src/**/*.{test,spec}.ts',
        'src/**/*.stories.ts',
        'src/**/*.d.ts',
        'src/test/**',
        'src/content/**',
        'src/i18n/**',
        'src/content.config.ts',
        // Thin Firebase SDK boundary: pure provisioning behavior is tested in
        // workshop-firebase.test.ts, while popup/listener wiring is exercised
        // through consumers that mock this module. SDK-owned branches are not
        // meaningful patch-coverage targets here.
        'src/config/workshop-firebase.ts'
      ]
    }
  }
})
