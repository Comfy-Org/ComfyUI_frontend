import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input: './test-workflows.openapi.yaml',
  output: { path: './src/test-workflows', clean: true },
  plugins: [
    '@hey-api/typescript',
    {
      name: 'zod',
      compatibilityVersion: 3,
      definitions: true,
      requests: false,
      responses: false
    }
  ]
})
