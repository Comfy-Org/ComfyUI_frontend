import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'router-playground',
    environment: 'happy-dom',
    // The moved suites ran under the website's timer setup; keep it.
    setupFiles: ['../../vitest.timer.setup.ts'],
    fakeTimers: { shouldAdvanceTime: true },
    include: ['src/**/*.{test,spec}.ts'],
    mockReset: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**']
    }
  }
})
