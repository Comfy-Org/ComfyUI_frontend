import { globSync } from 'node:fs'
import { relative } from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

import { nativeControlsCss, nativeControlsEntry } from './nativeControlsCss'
import manifest from './package.json'

export default defineConfig({
  plugins: [
    nativeControlsCss(),
    tailwindcss(),
    vue(),
    dts({
      tsconfigPath: 'tsconfig.build.json',
      entryRoot: 'src/components'
    })
  ],
  build: {
    lib: {
      entry: Object.fromEntries([
        ['native-controls', nativeControlsEntry],
        ...[
          ...globSync('src/components/**/*.vue'),
          ...Object.entries(manifest.exports).flatMap(([key, target]) =>
            key.startsWith('./lib/') && typeof target === 'string'
              ? [target]
              : []
          )
        ].map((file) => [
          relative('src/components', file).replace(/\.ts$/, ''),
          file
        ])
      ]),
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
