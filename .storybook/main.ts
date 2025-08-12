import type { StorybookConfig } from '@storybook/vue3-vite'
import path from 'path'
import { fileURLToPath } from 'url'
import { type InlineConfig, mergeConfig } from 'vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-docs'],
  framework: {
    name: '@storybook/vue3-vite',
    options: {}
  },
  async viteFinal(config) {
    return mergeConfig(config, {
      server: {
        allowedHosts: true
      },
      resolve: {
        alias: {
          '@': __dirname + '/../src'
        }
      },
      build: {
        rollupOptions: {
          external: (id) => {
            // Suppress warnings for unused Vue internal imports
            return false
          },
          onwarn: (warning, warn) => {
            // Suppress specific warnings
            if (
              warning.code === 'UNUSED_EXTERNAL_IMPORT' &&
              warning.message?.includes('resolveComponent')
            ) {
              return
            }
            warn(warning)
          },
          output: {
            manualChunks: {
              'vue-vendor': ['vue', 'vue-router'],
              primevue: ['primevue/config', 'primevue'],
              'storybook-docs': ['@storybook/docs-tools'],
              litegraph: ['./src/lib/litegraph']
            }
          }
        },
        chunkSizeWarningLimit: 1000
      }
    } satisfies InlineConfig)
  }
}
export default config
