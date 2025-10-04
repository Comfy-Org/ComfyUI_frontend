import type { StorybookConfig } from '@storybook/vue3-vite'
import { FileSystemIconLoader } from 'unplugin-icons/loaders'
import IconsResolver from 'unplugin-icons/resolver'
import Icons from 'unplugin-icons/vite'
import Components from 'unplugin-vue-components/vite'
import type { InlineConfig } from 'vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx|mdx|vue)'],
  addons: ['@storybook/addon-docs'],
  framework: {
    name: '@storybook/vue3-vite',
    options: {}
  },
  async viteFinal(config) {
    const { mergeConfig } = await import('vite')
    const { default: tailwindcss } = await import('@tailwindcss/vite')

    if (config.plugins) {
      config.plugins = config.plugins
        .filter(
          (plugin): plugin is NonNullable<typeof plugin> & { name: string } =>
            plugin && typeof plugin === 'object' && 'name' in plugin
        )
        .filter((plugin) => !plugin.name.includes('import-map'))
    }

    return mergeConfig(config, {
      plugins: [
        tailwindcss(),
        Icons({
          compiler: 'vue3',
          customCollections: {
            comfy: FileSystemIconLoader(
              process.cwd() + '/../../packages/design-system/src/icons'
            )
          }
        }),
        Components({
          dts: false,
          resolvers: [IconsResolver({ customCollections: ['comfy'] })],
          dirs: [
            process.cwd() + '/src/components',
            process.cwd() + '/src/views'
          ],
          deep: true,
          extensions: ['vue'],
          directoryAsNamespace: true
        })
      ],
      server: {
        allowedHosts: true
      },
      resolve: {
        alias: {
          '@': process.cwd() + '/src',
          '@frontend-locales': process.cwd() + '/../../src/locales'
        }
      },
      build: {
        rollupOptions: {
          external: () => false
        },
        chunkSizeWarningLimit: 1000
      }
    } satisfies InlineConfig)
  }
}

export default config
