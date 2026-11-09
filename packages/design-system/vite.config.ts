import { globSync } from 'node:fs'
import { relative } from 'node:path'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

import manifest from './package.json'

export default defineConfig({
  plugins: [
    vue(),
    dts({
      tsconfigPath: 'tsconfig.build.json',
      entryRoot: 'src/components'
    })
  ],
  build: {
    lib: {
      entry: Object.fromEntries(
        [
          ...globSync('src/components/**/*.vue'),
          ...Object.entries(manifest.exports)
            .filter(([key]) => key.startsWith('./lib/'))
            .map(([, target]) => target)
        ].map((file) => [
          relative('src/components', file).replace(/\.ts$/, ''),
          file
        ])
      ),
      cssFileName: 'components',
      formats: ['es']
    },
    minify: false,
    rolldownOptions: {
      external:
        /^(vue|cva|reka-ui|@vueuse\/(core|integrations)|chart\.js|clsx|dompurify|es-toolkit|fuse\.js|tailwind-merge)(\/|$)/,
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'shared/[name]-[hash].js'
      }
    }
  }
})
