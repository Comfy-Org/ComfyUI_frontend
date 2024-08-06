import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/litegraph.js'),
      name: 'litegraph.js',
      // TODO: Below workaround ensures output matches pre-vite format.  Should be removed.
      fileName: (moduleFormat, entryAlias) => 'src/litegraph.js',
      formats: ['iife']
    },
    minify: false,
    sourcemap: true,
    rollupOptions: {
      // Disabling tree-shaking
      // Prevent vite remove unused exports
      treeshake: false
    }
  },
})