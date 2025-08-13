import type { StorybookConfig } from '@storybook/vue3-vite'
import path from 'path'
import { FileSystemIconLoader } from 'unplugin-icons/loaders'
import IconsResolver from 'unplugin-icons/resolver'
import Icons from 'unplugin-icons/vite'
import Components from 'unplugin-vue-components/vite'
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
      plugins: [
        Icons({
          compiler: 'vue3',
          customCollections: {
            comfy: FileSystemIconLoader(
              __dirname + '/../src/assets/icons/custom'
            )
          }
        }),
        Components({
          dts: false, // Disable dts generation in Storybook
          resolvers: [
            IconsResolver({
              customCollections: ['comfy']
            })
          ],
          dirs: [
            __dirname + '/../src/components',
            __dirname + '/../src/layout',
            __dirname + '/../src/views'
          ],
          deep: true,
          extensions: ['vue']
        })
      ],
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
          output: {}
        },
        chunkSizeWarningLimit: 1000
      }
    } satisfies InlineConfig)
  }
}
export default config
