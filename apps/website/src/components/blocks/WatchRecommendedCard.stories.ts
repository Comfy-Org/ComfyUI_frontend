import type { Meta, StoryObj } from '@storybook/vue3-vite'

import WatchRecommendedCard from './WatchRecommendedCard.vue'

const meta: Meta<typeof WatchRecommendedCard> = {
  title: 'Website/Blocks/WatchRecommendedCard',
  component: WatchRecommendedCard,
  tags: ['autodocs'],
  args: {
    item: {
      id: 'huntress',
      title: 'Huntress’s Tale Title here',
      credit: 'Creator credit',
      tag: 'Action',
      href: '#',
      poster:
        'https://media.comfy.org/website/learning/cleanplate_walkthrough_v03_thumbnail.jpg'
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithoutTag: Story = {
  args: {
    item: {
      id: 'huntress',
      title: 'Huntress’s Tale Title here',
      credit: 'Creator credit',
      href: '#',
      poster:
        'https://media.comfy.org/website/learning/cleanplate_walkthrough_v03_thumbnail.jpg'
    }
  }
}
