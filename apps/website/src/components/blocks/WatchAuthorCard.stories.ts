import type { Meta, StoryObj } from '@storybook/vue3-vite'

import WatchAuthorCard from './WatchAuthorCard.vue'

const meta: Meta<typeof WatchAuthorCard> = {
  title: 'Website/Blocks/WatchAuthorCard',
  component: WatchAuthorCard,
  tags: ['autodocs'],
  args: {
    name: 'Author / Studio name',
    detail: 'Studio · 1.2M subscribers',
    avatar: 'https://media.comfy.org/website/learning/animation1-thumb.jpg'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithoutAvatar: Story = {
  args: { avatar: undefined }
}

export const NameOnly: Story = {
  args: { avatar: undefined, detail: undefined }
}
