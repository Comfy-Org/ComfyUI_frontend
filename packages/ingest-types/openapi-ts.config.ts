import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input: './openapi.yaml',
  output: {
    path: './src',
    clean: true
  },
  parser: {
    filters: {
      operations: {
        exclude: [
          // Webhooks are server-to-server, not called by frontend
          '/\\/api\\/webhooks\\//',
          // Internal analytics endpoint
          '/\\/api\\/internal\\//'
        ]
      }
    }
  },
  plugins: [
    '@hey-api/typescript',
    {
      name: 'zod',
      compatibilityVersion: 3,
      definitions: true,
      requests: true,
      responses: true
    }
  ]
})
