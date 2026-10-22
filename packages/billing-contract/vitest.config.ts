import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'billing-contract',
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    mockReset: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    silent: 'passed-only',
    setupFiles: [
      '../../vitest.console.setup.ts',
      '../../vitest.network.setup.ts'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**']
    }
  }
})
