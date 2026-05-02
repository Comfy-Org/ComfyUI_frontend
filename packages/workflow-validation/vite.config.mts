import { resolve } from 'path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'workflow-validation',
      formats: ['es'],
      fileName: 'index'
    },
    copyPublicDir: false,
    minify: false,
    rollupOptions: {
      external: ['zod', 'zod-validation-error']
    }
  },
  plugins: [
    dts({
      tsconfigPath: 'tsconfig.json',
      include: ['src/**/*'],
      exclude: ['src/**/*.test.ts']
    })
  ]
})
