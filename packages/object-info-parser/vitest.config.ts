import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    mockReset: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    globals: false
  }
})
