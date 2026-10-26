import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/compositor/webglCompositor.ts', 'src/**/*.d.ts']
    },
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    globals: false,
    mockReset: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    silent: 'passed-only',
    fakeTimers: { shouldAdvanceTime: true },
    env: { TZ: 'UTC' },
    setupFiles: [
      '../../vitest.console.setup.ts',
      '../../vitest.network.setup.ts',
      '../../vitest.timer.setup.ts'
    ]
  }
})
