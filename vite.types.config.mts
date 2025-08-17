import { resolve } from 'path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

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
      rollupTypes: true,
      tsconfigPath: 'tsconfig.types.json',
      beforeWriteFile: (filePath, content) => {
        // Remove #private field declarations to prevent conflicts with external packages
        // This fixes issue #5033 where #private fields cause type incompatibility
        const cleanedContent = content
          .replace(/\s*#private;\s*/g, '') // Remove "#private;" declarations
          .replace(/\s*#[a-zA-Z_$][a-zA-Z0-9_$]*\s*:\s*[^;]+;\s*/g, '') // Remove full private field declarations
        return {
          filePath,
          content: cleanedContent
        }
      }
    })
  ]
})
