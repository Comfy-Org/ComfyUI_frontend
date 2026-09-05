import type { Meta, StoryObj } from '@storybook/vue3-vite'

import CardSplitContent02 from './CardSplitContent02.vue'

const meta: Meta<typeof CardSplitContent02> = {
  title: 'Website/Blocks/CardSplitContent02',
  component: CardSplitContent02,
  tags: ['autodocs'],
  decorators: [
    () => ({
      template: '<div class="bg-primary-comfy-ink"><story /></div>'
    })
  ],
  parameters: {
    layout: 'fullscreen'
  },
  args: {
    title: 'Govern the build, models, people, and usage.',
    imageSrc: '/assets/enterprise/govern-matrix-city.webp'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Reversed: Story = {
  args: {
    title: 'Capacity and support for production.',
    imageSrc: '/assets/enterprise/capacity-checker-falls.webp',
    reverse: true
  }
}
