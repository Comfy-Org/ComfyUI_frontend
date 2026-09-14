import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const TEST_SYSTEM_TIME = Date.parse('2024-06-15T12:00:00Z')

const timerSetup = fileURLToPath(
  new URL('../../vitest.timer.setup.ts', import.meta.url)
)

const happyDomOptions = {
  happyDOM: {
    settings: {
      disableIframePageLoading: true,
      disableCSSFileLoading: true,
      disableJavaScriptFileLoading: true
    }
  }
}

const sharedTest = {
  mockReset: true,
  restoreMocks: true,
  unstubEnvs: true,
  unstubGlobals: true,
  fakeTimers: { now: TEST_SYSTEM_TIME, shouldAdvanceTime: true },
  globals: true,
  environment: 'happy-dom',
  environmentOptions: happyDomOptions,
  env: { TZ: 'UTC' },
  setupFiles: [timerSetup]
} as const

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          ...sharedTest,
          name: 'account-core',
          include: [
            'src/core/**/*.{test,spec}.ts',
            'src/web/**/*.{test,spec}.ts',
            'src/provisioning.test.ts',
            'src/redirect.test.ts',
            'src/webviewDetection.test.ts',
            'src/firebaseAuthError.test.ts',
            'src/turnstile.test.ts',
            'src/turnstileScript.test.ts',
            'src/signInSchemas.test.ts',
            'src/vueBoundary.test.ts'
          ]
        }
      },
      {
        plugins: [vue()],
        test: {
          ...sharedTest,
          name: 'account-vue',
          include: [
            'src/vue/**/*.{test,spec}.ts',
            'src/firebase/**/*.{test,spec}.ts'
          ]
        }
      }
    ]
  }
})
