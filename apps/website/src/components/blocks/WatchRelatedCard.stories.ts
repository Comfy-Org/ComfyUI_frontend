import type { Meta, StoryObj } from '@storybook/vue3-vite'

import WatchRelatedCard from './WatchRelatedCard.vue'

const meta: Meta<typeof WatchRelatedCard> = {
  title: 'Website/Blocks/WatchRelatedCard',
  component: WatchRelatedCard,
  tags: ['autodocs'],
  args: {
    item: {
      id: 'e2',
      label: 'Episode 2',
      href: '#',
      poster:
        'https://media.comfy.org/website/learning/cleanplate_walkthrough_v03_thumbnail.jpg'
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
