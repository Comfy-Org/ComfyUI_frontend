import type { Meta, StoryObj } from '@storybook/vue3-vite'

import FooterLinkColumn from './FooterLinkColumn.vue'

const meta: Meta<typeof FooterLinkColumn> = {
  title: 'Website/Common/FooterLinkColumn',
  component: FooterLinkColumn,
  tags: ['autodocs'],
  decorators: [
    () => ({
      template:
        '<div class="bg-primary-comfy-ink text-primary-comfy-canvas p-8"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    title: 'Product',
    links: [
      { label: 'Local', href: '/local' },
      { label: 'Cloud', href: '/cloud' },
      { label: 'API', href: '/api' },
      { label: 'Enterprise', href: '/enterprise' }
    ]
  }
}

export const WithExternalLinks: Story = {
  args: {
    title: 'Community',
    links: [
      { label: 'Discord', href: 'https://discord.gg/comfy', external: true },
      { label: 'GitHub', href: 'https://github.com/comfy', external: true },
      { label: 'Twitter', href: 'https://twitter.com/comfy', external: true },
      { label: 'Blog', href: '/blog' }
    ]
  }
}
