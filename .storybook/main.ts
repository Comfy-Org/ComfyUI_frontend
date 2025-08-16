import type { StorybookConfig } from '@storybook/vue3-vite'
import vue from '@vitejs/plugin-vue'
import { FileSystemIconLoader } from 'unplugin-icons/loaders'
import IconsResolver from 'unplugin-icons/resolver'
import Icons from 'unplugin-icons/vite'
import Components from 'unplugin-vue-components/vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-controls',
    '@storybook/addon-actions',
    '@storybook/addon-viewport',
    '@storybook/addon-backgrounds'
  ],
  framework: {
    name: '@storybook/vue3-vite',
    options: {}
  },
  viteFinal: async (config) => {
    const { mergeConfig } = await import('vite')

    return mergeConfig(config, {
      plugins: [
        vue(),
        Icons({
          compiler: 'vue3',
          customCollections: {
            comfy: FileSystemIconLoader('../src/assets/icons/custom')
          }
        }),
        Components({
          dts: false, // Disable DTS generation for Storybook
          resolvers: [
            IconsResolver({
              customCollections: ['comfy']
            })
          ],
          dirs: ['../src/components', '../src/layout', '../src/views'],
          deep: true,
          extensions: ['vue']
        })
      ],
      resolve: {
        alias: {
          '@': new URL('../src', import.meta.url).pathname
        }
      },
      define: {
        ...config.define,
        global: 'globalThis',
        __COMFYUI_FRONTEND_VERSION__: JSON.stringify('1.26.4'),
        __SENTRY_ENABLED__: JSON.stringify(false),
        __SENTRY_DSN__: JSON.stringify(''),
        __ALGOLIA_APP_ID__: JSON.stringify(''),
        __ALGOLIA_API_KEY__: JSON.stringify(''),
        __USE_PROD_CONFIG__: JSON.stringify(false)
      }
    })
  }
}
export default config
