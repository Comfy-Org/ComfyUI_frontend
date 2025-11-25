import path from 'path'

import type { StorybookConfig } from '@storybook/vue3-vite'
import { FileSystemIconLoader } from 'unplugin-icons/loaders'
import IconsResolver from 'unplugin-icons/resolver'
import Icons from 'unplugin-icons/vite'
import Components from 'unplugin-vue-components/vite'
import type { InlineConfig, Plugin } from 'vite'

// Custom plugin to resolve @ alias based on importer location
// Desktop files (apps/desktop-ui/*) resolve @ to apps/desktop-ui/src
// All other files resolve @ to src
function conditionalAliasPlugin(): Plugin {
  const rootDir = process.cwd()
  const desktopSrc = path.join(rootDir, 'apps/desktop-ui/src')
  const cloudSrc = path.join(rootDir, 'src')

  return {
    name: 'conditional-alias',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!source.startsWith('@/') || !importer) return null

      const relativePath = source.slice(2) // Remove '@/'

      // Check if importer is from desktop app
      if (importer.includes('apps/desktop-ui/')) {
        return path.join(desktopSrc, relativePath)
      }

      // Default to cloud/main src
      return path.join(cloudSrc, relativePath)
    }
  }
}

const config: StorybookConfig = {
  stories: [
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    '../apps/desktop-ui/src/**/*.stories.@(js|jsx|mjs|ts|tsx)'
  ],
  addons: ['@storybook/addon-docs'],
  framework: {
    name: '@storybook/vue3-vite',
    options: {}
  },
  async viteFinal(config) {
    // Use dynamic import to avoid CJS deprecation warning
    const { mergeConfig } = await import('vite')
    const { default: tailwindcss } = await import('@tailwindcss/vite')

    // Filter out any plugins that might generate import maps
    if (config.plugins) {
      config.plugins = config.plugins
        // Type guard: ensure we have valid plugin objects with names
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
        // Business logic: filter out import-map plugins
        .filter((plugin) => !plugin.name.includes('import-map'))
    }

    return mergeConfig(config, {
      // Replace plugins entirely to avoid inheritance issues
      plugins: [
        // Conditional @ alias resolution for cloud vs desktop
        conditionalAliasPlugin(),
        // Only include plugins we explicitly need for Storybook
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
          dts: false, // Disable dts generation in Storybook
          resolvers: [
            IconsResolver({
              customCollections: ['comfy']
            })
          ],
          dirs: [
            // Cloud components
            process.cwd() + '/src/components',
            process.cwd() + '/src/layout',
            process.cwd() + '/src/views',
            // Desktop components
            process.cwd() + '/apps/desktop-ui/src/components',
            process.cwd() + '/apps/desktop-ui/src/views'
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
          // Note: @ alias is handled by conditionalAliasPlugin for cloud vs desktop
          // Desktop app locale alias
          '@frontend-locales': process.cwd() + '/src/locales'
        }
      },
      esbuild: {
        // Prevent minification of identifiers to preserve _sfc_main
        minifyIdentifiers: false,
        keepNames: true
      },
      build: {
        rollupOptions: {
          // Disable tree-shaking for Storybook to prevent Vue SFC exports from being removed
          treeshake: false,
          onwarn: (warning, warn) => {
            // Suppress specific warnings
            if (
              warning.code === 'UNUSED_EXTERNAL_IMPORT' &&
              warning.message?.includes('resolveComponent')
            ) {
              return
            }
            // Suppress Storybook font asset warnings
            if (
              warning.code === 'UNRESOLVED_IMPORT' &&
              warning.message?.includes('nunito-sans')
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
