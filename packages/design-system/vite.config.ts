import { globSync } from 'node:fs'
import { relative } from 'node:path'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    vue(),
    dts({
      tsconfigPath: 'tsconfig.build.json',
      entryRoot: 'src/components',
      cleanVueFileName: true
    })
  ],
  build: {
    lib: {
      entry: Object.fromEntries(
        globSync('src/components/**/*.{vue,ts}').map((file) => [
          relative('src/components', file).replace(/\.(vue|ts)$/, ''),
          file
        ])
      ),
      cssFileName: 'components',
      formats: ['es']
    },
    minify: false,
    rollupOptions: {
      external:
        /^(vue|cva|reka-ui|@vueuse\/core|chart\.js|dompurify|es-toolkit)(\/|$)/,
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'shared/[name]-[hash].js'
      }
    }
  }
})
