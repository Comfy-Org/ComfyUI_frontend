import type { Meta, StoryObj } from '@storybook/vue3-vite'

import WatchChapterStrip from './WatchChapterStrip.vue'

const poster =
  'https://media.comfy.org/website/learning/cleanplate_walkthrough_v03_thumbnail.jpg'

const meta: Meta<typeof WatchChapterStrip> = {
  title: 'Website/Blocks/WatchChapterStrip',
  component: WatchChapterStrip,
  tags: ['autodocs'],
  args: {
    heading: 'Chapter',
    items: [
      { id: 'e2', label: 'Episode 2', href: '#', poster },
      { id: 'e3', label: 'Episode 3', href: '#', poster },
      { id: 'e4', label: 'Episode 4', href: '#', poster }
    ]
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = {
  args: { items: [] }
}
