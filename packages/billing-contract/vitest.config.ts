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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**']
    }
  }
})
