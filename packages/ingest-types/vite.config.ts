import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

import { definePublishedPackageConfig } from '@comfyorg/published-package-build'

export default defineConfig(
  definePublishedPackageConfig({
    packageDir: fileURLToPath(new URL('.', import.meta.url)),
    external: [/^zod$/]
  })
)
