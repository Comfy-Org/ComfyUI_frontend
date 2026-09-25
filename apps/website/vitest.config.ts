import { fileURLToPath } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      'astro:env/client': fileURLToPath(
        new URL('./src/test/astroEnv.ts', import.meta.url)
      ),
      '@': fileURLToPath(new URL('./src', import.meta.url))
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
        'src/**/__mocks__/**',
        'src/**/__fixtures__/**',
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
    },
    projects: [
      {
        extends: true,
        plugins: [vue()],
        test: {
          name: 'unit',
          include: ['src/**/*.{test,spec}.ts', 'scripts/**/*.{test,spec}.ts']
        }
      },
      {
        extends: true,
        plugins: [
          storybookTest({
            configDir: fileURLToPath(new URL('.storybook', import.meta.url))
          })
        ],
        test: {
          name: 'storybook',
          fileParallelism: false,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [
              {
                browser: 'chromium'
              }
            ]
          }
        }
      }
    ]
  }
})
