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
        // Exclude endpoints that overlap with ComfyUI Python backend.
        // These are shared between local and cloud, with separate Zod
        // schemas already maintained in src/schemas/apiSchema.ts.
        exclude: [
          '/^GET \\/api\\/prompt$/',
          '/^POST \\/api\\/prompt$/',
          '/^GET \\/api\\/queue$/',
          '/^POST \\/api\\/queue$/',
          '/^GET \\/api\\/history$/',
          '/^POST \\/api\\/history$/',
          '/^GET \\/api\\/history_v2/',
          '/^GET \\/api\\/object_info$/',
          '/^GET \\/api\\/features$/',
          '/^GET \\/api\\/settings$/',
          '/^POST \\/api\\/settings$/',
          '/^GET \\/api\\/system_stats$/',
          '/^(GET|POST) \\/api\\/interrupt$/',
          '/^POST \\/api\\/upload\\//',
          '/^GET \\/api\\/view$/',
          '/^GET \\/api\\/jobs/',
          '/\\/api\\/userdata/',
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
