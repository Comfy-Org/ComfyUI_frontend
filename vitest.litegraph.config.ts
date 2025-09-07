import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/lib/litegraph/test/**/*.test.ts']
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  define: {
    __USE_PROD_CONFIG__: false
  }
})
