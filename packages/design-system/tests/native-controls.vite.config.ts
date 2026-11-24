import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [tailwindcss()],
  resolve: {
    alias: {
      '/fonts': fileURLToPath(new URL('../../../public/fonts', import.meta.url))
    }
  },
  build: {
    outDir: 'dist/native-controls',
    rolldownOptions: { input: 'tests/native-controls.html' }
  }
})
