import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/litegraph.js'),
      name: 'litegraph.js',
      fileName: (format) => `litegraph.${format}.js`,
      formats: ['es', 'umd']
    },
    minify: false,
    sourcemap: true,
  },
})