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
      // Only the prompt submission endpoint. The spec describes 68 paths; the
      // frontend's hand-written request body corresponds to this one, and
      // widening the filter is the separate migration tracked on #22309.
      operations: { include: ['POST /api/prompt'] }
    }
  },
  plugins: ['@hey-api/typescript']
})
