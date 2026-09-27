import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, waitFor, within } from 'storybook/test'

import NodeBadge from './NodeBadge.vue'

const meta: Meta<typeof NodeBadge> = {
  title: 'Website/Common/NodeBadge',
  component: NodeBadge,
  tags: ['autodocs', 'stable'],
  decorators: [
    () => ({
      template: '<div class="bg-primary-comfy-ink p-8"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const TextOnly: Story = {
  args: {
    segments: [{ text: 'COMFY' }]
  }
}

export const MultipleSegments: Story = {
  args: {
    segments: [{ text: 'HOW' }, { text: 'IT' }, { text: 'WORKS' }]
  }
}

export const WithLogo: Story = {
  args: {
    segments: [
      { text: 'HOW' },
      { logoSrc: '/icons/logo.svg', logoAlt: 'Comfy' },
      { text: 'WORKS' }
    ],
    segmentClass: ''
  },
  play: async ({ canvasElement }) => {
    const logo = within(canvasElement).getByRole('img', { name: 'Comfy' })

    if (!(logo instanceof HTMLImageElement)) {
      throw new Error('Comfy logo did not render as an image')
    }
    await expect(logo).toHaveAttribute('src', '/icons/logo.svg')
    await waitFor(() => expect(logo.naturalWidth).toBeGreaterThan(0))
  }
}
