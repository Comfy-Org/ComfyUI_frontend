import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

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
      rollupTypes: true,
      tsconfigPath: 'tsconfig.types.json'
    })
  ]
})
