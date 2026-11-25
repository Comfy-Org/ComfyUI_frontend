import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      thresholds: {
        statements: 69,
        branches: 60,
        functions: 67,
        lines: 70
      }
    },
    mockReset: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    globals: false,
    env: { TZ: 'UTC' },
    setupFiles: [
      '../../vitest.console.setup.ts',
      '../../vitest.network.setup.ts',
      '../../vitest.timer.setup.ts'
    ]
  }
})
