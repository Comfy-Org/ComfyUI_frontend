import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, within } from 'storybook/test'
import type { ComponentProps } from 'vue-component-type-helpers'

import HeroBackdrop01 from './HeroBackdrop01.vue'

const sampleImage = '/images/mcp/mcp-thumb-keyart.webp'

type HeroBackdropStoryArgs = ComponentProps<typeof HeroBackdrop01>

const meta = {
  title: 'Website/Blocks/HeroBackdrop01',
  component: HeroBackdrop01,
  tags: ['autodocs', 'stable'],
  args: {
    backdrop: { type: 'image', src: sampleImage, alt: 'Abstract gradient' },
    title: 'Build anything\nwith ComfyUI',
    subtitle:
      'A powerful, modular visual interface for building and running AI workflows.'
  }
} satisfies Meta<HeroBackdropStoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(
      canvas.getByRole('heading', { level: 1, name: /build anything/i })
    ).toBeVisible()
    await expect(
      canvas.getByRole('img', { name: 'Abstract gradient' })
    ).toHaveAttribute('fetchpriority', 'high')
  }
}

export const WithBadge: Story = {
  args: {
    badgeText: 'New'
  }
}

export const WithFootnote: Story = {
  args: {
    footnote: 'Available on Windows, macOS, and Linux.'
  }
}

export const NoBackdrop: Story = {
  args: {
    backdrop: undefined
  }
}

export const Mobile: Story = {
  globals: {
    viewport: { value: 'mobile1', isRotated: false }
  }
}
