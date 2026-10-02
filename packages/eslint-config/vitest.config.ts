import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'eslint-config',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/imports.ts', 'src/vue.ts']
    }
  }
})
