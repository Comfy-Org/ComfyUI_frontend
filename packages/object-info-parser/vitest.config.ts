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
    silent: 'passed-only',
    fakeTimers: { shouldAdvanceTime: true },
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    globals: false,
    setupFiles: [
      '../../vitest.console.setup.ts',
      '../../vitest.network.setup.ts',
      '../../vitest.timer.setup.ts'
    ]
  }
})
