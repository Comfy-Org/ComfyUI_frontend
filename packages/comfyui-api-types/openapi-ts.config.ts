import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input: './openapi.yaml',
  output: {
    // Generated output is isolated under `generated/` because `clean` wipes the
    // directory it writes to. `src/index.ts` is hand-written and must survive.
    path: './src/generated',
    clean: true
  },
  parser: {
    filters: {
      operations: {
        include: [
          'POST /api/prompt',
          'GET /api/experiment/models/{folder}',
          'GET /api/features'
        ]
      }
    }
  },
  plugins: [
    '@hey-api/typescript',
    { name: 'zod', compatibilityVersion: 4, responses: true }
  ]
})
