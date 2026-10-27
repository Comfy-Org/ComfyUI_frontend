import type { StorybookConfig } from '@storybook/vue3-vite'
import vue from '@vitejs/plugin-vue'
import { FileSystemIconLoader } from 'unplugin-icons/loaders'
import IconsResolver from 'unplugin-icons/resolver'
import Icons from 'unplugin-icons/vite'
import Components from 'unplugin-vue-components/vite'
import type { Alias, AliasOptions, InlineConfig } from 'vite'

function withoutAppSrcAlias(alias: AliasOptions = []): Alias[] {
  const entries = Array.isArray(alias)
    ? alias
    : Object.entries(alias).map(([find, replacement]) => ({
        find,
        replacement
      }))
  return entries.filter(({ find }) => find !== '@')
}

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  staticDirs: ['../public'],
  addons: ['@storybook/addon-docs', '@storybook/addon-mcp'],
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
          (plugin): plugin is NonNullable<typeof plugin> & { name: string } => {
            return (
              plugin !== null &&
              plugin !== undefined &&
              typeof plugin === 'object' &&
              'name' in plugin &&
              typeof plugin.name === 'string'
            )
          }
        )
        .filter(
          (plugin) =>
            !plugin.name.includes('import-map') && plugin.name !== 'vite:vue'
        )
    }

    config.resolve = {
      ...config.resolve,
      alias: withoutAppSrcAlias(config.resolve?.alias)
    }

    return mergeConfig(config, {
      plugins: [
        vue({ template: { transformAssetUrls: { includeAbsolute: false } } }),
        tailwindcss(),
        Icons({
          compiler: 'vue3',
          customCollections: {
            comfy: FileSystemIconLoader(
              process.cwd() + '/packages/design-system/src/icons'
            )
          }
        }),
        Components({
          dts: false,
          resolvers: [
            IconsResolver({
              customCollections: ['comfy']
            })
          ],
          dirs: [
            process.cwd() + '/src/components',
            process.cwd() + '/src/layout',
            process.cwd() + '/src/views'
          ],
          deep: true,
          extensions: ['vue']
        })
      ],
      server: {
        allowedHosts: true
      },
      resolve: {
        tsconfigPaths: true,
        alias: [
          {
            find: '@/composables/queue/useJobList',
            replacement: process.cwd() + '/src/storybook/mocks/useJobList.ts'
          },
          {
            find: '@/platform/billing/composables/useBillingContext',
            replacement:
              process.cwd() + '/src/storybook/mocks/useBillingContext.ts'
          },
          {
            find: '@/composables/useFeatureFlags',
            replacement:
              process.cwd() + '/src/storybook/mocks/useFeatureFlags.ts'
          },
          {
            find: '@/platform/workspace/composables/useWorkspaceUI',
            replacement:
              process.cwd() + '/src/storybook/mocks/useWorkspaceUI.ts'
          },
          {
            find: '@/platform/billing/composables/useBillingCapabilities',
            replacement:
              process.cwd() + '/src/storybook/mocks/useBillingCapabilities.ts'
          },
          {
            find: '@/platform/workspace/stores/teamWorkspaceStore',
            replacement:
              process.cwd() + '/src/storybook/mocks/teamWorkspaceStore.ts'
          },
          {
            find: '@/composables/auth/useCurrentUser',
            replacement:
              process.cwd() + '/src/storybook/mocks/useCurrentUser.ts'
          },
          {
            find: '@/platform/workspace/composables/useWorkspaceUI',
            replacement:
              process.cwd() + '/src/storybook/mocks/useWorkspaceUI.ts'
          },
          {
            find: '@/base/credits/comfyCredits',
            replacement:
              process.cwd() +
              '/packages/shared-frontend-utils/src/creditsUtil.ts'
          },
          {
            find: '@/utils/formatUtil',
            replacement:
              process.cwd() +
              '/packages/shared-frontend-utils/src/formatUtil.ts'
          },
          {
            find: '@/utils/networkUtil',
            replacement:
              process.cwd() +
              '/packages/shared-frontend-utils/src/networkUtil.ts'
          }
        ]
      },
      build: {
        copyPublicDir: false,
        rolldownOptions: {
          treeshake: false,
          output: {
            keepNames: true,
            strictExecutionOrder: true
          },
          onwarn: (warning, warn) => {
            if (
              warning.code === 'UNUSED_EXTERNAL_IMPORT' &&
              warning.message.includes('resolveComponent')
            ) {
              return
            }
            if (
              warning.code === 'UNRESOLVED_IMPORT' &&
              warning.message.includes('nunito-sans')
            ) {
              return
            }
            warn(warning)
          }
        },
        chunkSizeWarningLimit: 1000
      }
    } satisfies InlineConfig)
  }
}
export default config
