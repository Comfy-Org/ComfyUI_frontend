import { fileURLToPath } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
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
        'src/content.config.ts'
      ]
    },
    projects: [
      {
        extends: true,
        plugins: [vue()],
        test: {
          mockReset: true,
          restoreMocks: true,
          unstubEnvs: true,
          unstubGlobals: true,
          fakeTimers: {
            shouldAdvanceTime: true
          },
          environment: 'node',
          include: ['src/**/*.{test,spec}.ts'],
          globals: false,
          setupFiles: ['../../vitest.timer.setup.ts', './src/test/setup.ts']
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
