import type { Meta, StoryObj } from '@storybook/vue3-vite'

import HeroBackdrop01 from './HeroBackdrop01.vue'

const sampleImage =
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80'

const meta: Meta<typeof HeroBackdrop01> = {
  title: 'Website/Blocks/HeroBackdrop01',
  component: HeroBackdrop01,
  tags: ['autodocs'],
  args: {
    backdrop: { type: 'image', src: sampleImage, alt: 'Abstract gradient' },
    title: 'Build anything\nwith ComfyUI',
    subtitle:
      'A powerful, modular visual interface for building and running AI workflows.'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

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
