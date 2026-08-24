import { fileURLToPath } from 'node:url'

import type { StorybookConfig } from '@storybook/vue3-vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import type { InlineConfig } from 'vite'

const websiteSource = fileURLToPath(new URL('../src', import.meta.url))

const config: StorybookConfig = {
  stories: [
    '../src/storybook/*.mdx',
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'
  ],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@storybook/addon-designs',
    'storybook-addon-tag-badges',
    '@storybook/addon-mcp',
    '@storybook/addon-vitest'
  ],
  tags: {
    deprecated: { defaultFilterSelection: 'exclude' },
    experimental: { defaultFilterSelection: 'exclude' }
  },
  framework: {
    name: '@storybook/vue3-vite',
    options: {}
  },
  staticDirs: [
    { from: '../public', to: '/' },
    { from: './generated', to: '/design-system' }
  ],
  async viteFinal(config) {
    const { mergeConfig } = await import('vite')

    return mergeConfig(config, {
      plugins: [vue(), tailwindcss()],
      resolve: {
        alias: {
          '@': websiteSource
        }
      },
      build: {
        chunkSizeWarningLimit: 1000
      }
    } satisfies InlineConfig)
  }
}

export default config
