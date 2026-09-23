import { fileURLToPath } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

/**
 * One entry per published export, so `dist` mirrors the export map and a
 * consumer importing `@comfyorg/account-ui/auth/regionGate` pulls in that
 * module rather than the whole package.
 */
const entries = {
  'billing/index': 'src/billing/index.ts',
  'billing/stripe/index': 'src/billing/stripe/index.ts',
  'auth/PasswordRules': 'src/auth/PasswordRules.vue',
  'auth/SocialAuthButtons': 'src/auth/SocialAuthButtons.vue',
  'auth/TurnstileWidget': 'src/auth/TurnstileWidget.vue',
  'auth/regionGate': 'src/auth/regionGate.ts',
  'auth/regionProbe': 'src/auth/regionProbe.ts',
  'auth/turnstileGate': 'src/auth/turnstileGate.ts',
  'auth/lifecycleScope': 'src/auth/lifecycleScope.ts',
  'auth/useGenerationGuard': 'src/auth/useGenerationGuard.ts'
}

/**
 * Vue, VueUse and the sibling packages resolve from the consumer's tree. A
 * bundled copy of Vue would give the consumer two runtimes, and the injection
 * keys the billing composables share are identity-compared.
 */
const EXTERNAL = [/^vue$/, /^@vueuse\//, /^@comfyorg\//, /^@stripe\//]

const resolveEntry = (path: string) =>
  fileURLToPath(new URL(path, import.meta.url))

/**
 * A `nodenext` consumer rejects an extensionless relative specifier, and the
 * emitted declarations carry the source's own — including the `./CheckoutSteps`
 * that `cleanVueFileName` leaves behind. Point each at the `.js` the bundle
 * writes beside it.
 */
const EXTENSIONLESS_RELATIVE = /(from |import\()(['"])(\.{1,2}\/[^'"]*)\2/g

const withDeclarationExtensions = (content: string) =>
  content.replace(
    EXTENSIONLESS_RELATIVE,
    (match, prefix: string, quote: string, specifier: string) =>
      specifier.split('/').at(-1)?.includes('.')
        ? match
        : `${prefix}${quote}${specifier}.js${quote}`
  )

export default defineConfig({
  build: {
    lib: {
      entry: Object.fromEntries(
        Object.entries(entries).map(([name, path]) => [
          name,
          resolveEntry(path)
        ])
      ),
      formats: ['es']
    },
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      external: EXTERNAL,
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'shared/[name]-[hash].js'
      }
    }
  },
  plugins: [
    vue(),
    dts({
      tsconfigPath: 'tsconfig.build.json',
      cleanVueFileName: true,
      logLevel: 'warn',
      beforeWriteFile: (_filePath, content) => ({
        content: withDeclarationExtensions(content)
      })
    })
  ]
})
