import vue from '@vitejs/plugin-vue'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

import { repoRoot } from './paths'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      'astro:middleware': 'astro/middleware',
      'astro:env/client': fileURLToPath(
        new URL('./src/test/astroEnv.ts', import.meta.url)
      )
    }
  },
  test: {
    mockReset: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
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
    include: ['src/**/*.{test,spec}.ts', 'scripts/**/*.{test,spec}.ts'],
    globals: false,
    setupFiles: [
      join(repoRoot, 'vitest.network.setup.ts'),
      join(repoRoot, 'vitest.timer.setup.ts'),
      './src/test/setup.ts'
    ],
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
        'src/**/__mocks__/**',
        'src/**/__fixtures__/**',
        'src/test/**',
        'src/content/**',
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
