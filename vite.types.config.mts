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
      aliases: [
        {
          find: /^#\/(.*)$/,
          replacement: resolve(__dirname, 'packages/litegraph/src/$1')
        }
      ],
      beforeWriteFile: createLitegraphDeclarationTransform(
        resolve(__dirname, 'packages/litegraph/src'),
        resolve(__dirname, 'packages/graph-model/src')
      )
    })
  ]
})
