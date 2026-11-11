import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
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
