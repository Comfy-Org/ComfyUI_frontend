import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { vfxTutorials } from '../../data/vfxTutorials'
import TutorialCard from './TutorialCard.vue'

const meta: Meta<typeof TutorialCard> = {
  title: 'Website/Common/TutorialCard',
  component: TutorialCard,
  tags: ['autodocs'],
  args: {
    tutorial: vfxTutorials[0],
    titlePrefixKey: 'learning.tutorials.titlePrefix'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Overlay: Story = {
  args: {
    variant: 'overlay',
    titlePrefixKey: undefined,
    tutorial: {
      ...vfxTutorials[0],
      author: { name: 'Author Name', avatarSrc: '/icons/clients/Apple.svg' }
    }
  }
}
