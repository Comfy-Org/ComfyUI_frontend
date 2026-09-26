import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**']
    },
    mockReset: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    fakeTimers: { shouldAdvanceTime: true },
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    globals: false,
    env: { TZ: 'UTC' },
    setupFiles: ['../../vitest.timer.setup.ts']
  }
})
