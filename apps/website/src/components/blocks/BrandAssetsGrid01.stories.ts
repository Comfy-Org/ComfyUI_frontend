import type { Meta, StoryObj } from '@storybook/vue3-vite'

import BrandAssetsGrid01 from './BrandAssetsGrid01.vue'

const assets = [
  { id: 'logo', title: 'Primary logo', preview: '/icons/logo.svg' },
  { id: 'mark', title: 'Comfy mark', preview: '/icons/logomark.svg' },
  {
    id: 'github',
    title: 'GitHub avatar',
    preview: '/icons/social/github.svg'
  },
  {
    id: 'discord',
    title: 'Discord avatar',
    preview: '/icons/social/discord.svg'
  }
]

const meta: Meta<typeof BrandAssetsGrid01> = {
  title: 'Website/Blocks/BrandAssetsGrid01',
  component: BrandAssetsGrid01,
  tags: ['autodocs'],
  args: {
    heading: 'Comfy brand assets',
    subheading:
      'Use these approved assets when representing <strong>Comfy</strong>.',
    cta: { label: 'DOWNLOAD BRAND KIT', href: '#' },
    assets
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const TwoAssets: Story = {
  args: {
    assets: assets.slice(0, 2)
  }
}

export const Mobile: Story = {
  globals: {
    viewport: { value: 'mobile1', isRotated: false }
  }
}
