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
      entry: {
        'card/Card': 'src/components/card/Card.vue',
        'card/CardHeader': 'src/components/card/CardHeader.vue',
        'card/CardTitle': 'src/components/card/CardTitle.vue',
        'card/CardFooter': 'src/components/card/CardFooter.vue'
      },
      formats: ['es']
    },
    minify: false,
    rollupOptions: {
      external: ['vue', 'cva'],
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'shared/[name]-[hash].js'
      }
    }
  }
})
