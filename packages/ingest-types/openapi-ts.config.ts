import { defineConfig } from '@hey-api/openapi-ts'

const HTTP_METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace'
] as const

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : null

export default defineConfig({
  input: './openapi.yaml',
  output: {
    path: './src',
    clean: true
  },
  parser: {
    // Strip `x-internal: true` operations (admin + internal rails) before
    // generation so they never leak into this public package. Keyed on
    // `x-internal`, never `x-runtime` — cloud-only-but-FE-facing endpoints
    // such as /api/secrets/* are `x-runtime` and must stay.
    patch: {
      input: (spec) => {
        const paths = asRecord(spec.paths)
        if (!paths) return
        for (const [path, pathItem] of Object.entries(paths)) {
          const item = asRecord(pathItem)
          if (!item) continue
          let removedOperation = false
          for (const method of HTTP_METHODS) {
            const operation = asRecord(item[method])
            if (operation?.['x-internal'] === true) {
              delete item[method]
              removedOperation = true
            }
          }
          if (
            removedOperation &&
            !HTTP_METHODS.some((method) => item[method])
          ) {
            delete paths[path]
          }
        }
      }
    },
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
