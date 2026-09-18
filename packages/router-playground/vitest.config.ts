import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'router-playground',
    environment: 'happy-dom',
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
