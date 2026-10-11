import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input: './openapi/rate-card.yaml',
  output: {
    path: './src/types/rate-card',
    clean: true,
    importFileExtension: '.js'
  },
  plugins: [
    '@hey-api/typescript',
    {
      name: 'zod',
      compatibilityVersion: 4,
      definitions: true,
      responses: true
    }
  ]
})
