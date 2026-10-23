import { resolve } from 'path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

import { createLitegraphDeclarationTransform } from './scripts/litegraphDeclarations'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/types/index.ts'),
      name: 'comfyui-frontend-types',
      formats: ['es'],
      fileName: 'index'
    },
    copyPublicDir: false,
    minify: false
  },

  plugins: [
    dts({
      copyDtsFiles: true,
      bundleTypes: true,
      processor: 'vue',
      tsconfigPath: 'tsconfig.types.json',
      beforeWriteFile: createLitegraphDeclarationTransform(
        resolve(__dirname, 'src/lib/litegraph/src')
      )
    })
  ]
})
