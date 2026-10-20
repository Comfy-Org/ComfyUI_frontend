import { dirname, join } from 'node:path'

import type { StorybookConfig } from '@storybook/vue3-vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import type { InlineConfig } from 'vite'

import { catalogStoryPatterns } from './story-discovery'

const websiteRoot = dirname(import.meta.dirname)
const repositoryRoot = dirname(dirname(websiteRoot))
const websiteSource = join(websiteRoot, 'src')

const isNamedPlugin = (plugin: unknown): plugin is { name: string } =>
  typeof plugin === 'object' &&
  plugin !== null &&
  'name' in plugin &&
  typeof plugin.name === 'string'

const config: StorybookConfig = {
  stories: [
    '../src/storybook/*.mdx',
    ...catalogStoryPatterns.map((pattern) => `../${pattern}`)
  ],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@storybook/addon-designs',
    'storybook-addon-tag-badges',
    '@storybook/addon-mcp'
  ],
  tags: {
    deprecated: { defaultFilterSelection: 'exclude' }
  },
  framework: {
    name: '@storybook/vue3-vite',
    options: {}
  },
  staticDirs: [
    { from: join(websiteRoot, 'public'), to: '/' },
    { from: join(repositoryRoot, 'public/fonts'), to: '/fonts' },
    { from: './generated', to: '/design-system' }
  ],
  async viteFinal(config) {
    const { mergeConfig } = await import('vite')

    config.plugins = config.plugins?.filter(
      (plugin) => !isNamedPlugin(plugin) || plugin.name !== 'vite:vue'
    )

    return mergeConfig(config, {
      publicDir: false,
      plugins: [
        vue({
          template: {
            transformAssetUrls: false
          }
        }),
        tailwindcss()
      ],
      resolve: {
        alias: {
          '@': websiteSource,
          'astro:env/client': join(websiteSource, 'test/astroEnv.ts')
        }
      },
      optimizeDeps: {
        include: ['gsap', 'gsap/ScrollToPlugin', 'gsap/ScrollTrigger', 'lenis']
      },
      build: {
        chunkSizeWarningLimit: 1000
      }
    } satisfies InlineConfig)
  }
}

export default config
