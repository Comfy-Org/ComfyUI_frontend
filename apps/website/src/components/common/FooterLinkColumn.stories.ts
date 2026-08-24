import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'

import FooterLinkColumn from './FooterLinkColumn.vue'

const meta: Meta<typeof FooterLinkColumn> = {
  title: 'Website/Common/FooterLinkColumn',
  component: FooterLinkColumn,
  tags: ['autodocs', 'stable'],
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
      { label: 'Desktop', href: '/download' },
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
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const discord = canvas.getByRole('link', { name: 'Discord' })

    await expect(discord).toHaveAttribute('target', '_blank')
    await expect(discord).toHaveAttribute('rel', 'noopener')
    await userEvent.tab()
    await expect(discord).toHaveFocus()
  }
}
