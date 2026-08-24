import type { Meta, StoryObj } from '@storybook/vue3-vite'

import CardArticle01 from './CardArticle01.vue'

const baseItem = {
  id: 'mcp-launch',
  badge: 'NEW',
  category: 'Launches',
  title: 'Connect coding agents to ComfyUI with the Comfy MCP Server',
  description:
    'Build and run visual workflows directly from the tools where you write code.',
  media: {
    type: 'image' as const,
    src: '/images/mcp/mcp-thumb-keyart.webp',
    alt: 'Comfy MCP launch key art'
  },
  cta: { label: 'READ MORE', href: '#' }
}

const meta: Meta<typeof CardArticle01> = {
  title: 'Website/Blocks/CardArticle01',
  component: CardArticle01,
  tags: ['autodocs'],
  decorators: [
    () => ({
      template: '<div class="mx-auto max-w-xl p-6"><story /></div>'
    })
  ],
  args: {
    item: baseItem
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithAuthor: Story = {
  args: {
    item: {
      ...baseItem,
      category: 'Community',
      author: {
        name: 'Comfy Team',
        avatarSrc: '/assets/images/fallback-gradient-avatar.svg'
      }
    }
  }
}

export const Minimal: Story = {
  args: {
    item: {
      ...baseItem,
      badge: undefined,
      description: undefined
    }
  }
}

export const LongTitleClamped: Story = {
  args: {
    titleClamp: true,
    item: {
      ...baseItem,
      title:
        'How creative teams are building repeatable production systems with open models, custom nodes, and reusable ComfyUI workflows'
    }
  }
}
