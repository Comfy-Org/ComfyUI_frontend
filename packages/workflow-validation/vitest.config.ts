import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
    mockReset: true,
    restoreMocks: true,
    setupFiles: ['../../vitest.timer.setup.ts'],
    unstubEnvs: true,
    unstubGlobals: true
  }
})
