import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * Vitest config for the extension-api test suite (I-TF).
 *
 * Runs only the extension-api-v2 __tests__ stubs — isolated from the main
 * unit suite so the compat-floor gate can run independently on PRs that
 * touch src/extension-api/** or src/extension-api-v2/**.
 *
 * Coverage is scoped to src/extension-api/ (the public declaration files)
 * and src/extension-api-v2/ (the impl + test stubs).
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    deps: {
      // Force Vue packages through the browser ESM build so internal exports
      // (pauseTracking, resetTracking) are available in the test environment.
      // Without this, Vite uses the CJS/SSR build of Vue which does not re-export
      // these @vue/reactivity internals.
      optimizer: {
        ssr: {
          include: ['vue', '@vue/reactivity', '@vue/runtime-core', '@vue/runtime-dom']
        }
      }
    },
    include: [
      'src/extension-api-v2/__tests__/**/*.{test,spec}.{ts,mts}'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov'],
      include: [
        'src/extension-api/**/*.ts',
        'src/extension-api-v2/**/*.ts'
      ],
      exclude: [
        'src/extension-api-v2/__tests__/**'
      ]
    },
    reporter: process.env.CI ? ['verbose', 'github-actions'] : ['verbose']
  }
})
