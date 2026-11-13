import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input: './homepage-consent.openapi.json',
  output: { path: './src/homepage-consent', clean: true },
  plugins: [
    '@hey-api/typescript',
    { name: 'zod', compatibilityVersion: 4, definitions: true }
  ]
})
