import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

import { definePublishedPackageConfig } from '@comfyorg/published-package-build'

/**
 * Vue, VueUse, Reka and the sibling packages resolve from the consumer's
 * tree. A bundled copy of Vue would give the consumer two runtimes, and the
 * injection keys the billing composables share are identity-compared. The
 * stateless class recipes (`design-system`'s variants, `tailwind-utils`'s
 * `cn`) are the exception: they are bundled, since neither ships a build a
 * plain consumer can import.
 */
const EXTERNAL = [
  /^vue$/,
  /^@vueuse\//,
  /^@comfyorg\/(?!design-system\/|tailwind-utils$)/,
  /^@stripe\//,
  /^reka-ui$/
]

export default defineConfig(
  definePublishedPackageConfig({
    packageDir: fileURLToPath(new URL('.', import.meta.url)),
    external: EXTERNAL,
    plugins: [vue()],
    cleanVueFileName: true
  })
)
