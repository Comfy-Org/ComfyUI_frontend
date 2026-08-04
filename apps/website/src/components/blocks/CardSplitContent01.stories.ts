import type { Meta, StoryObj } from '@storybook/vue3-vite'

import CardSplitContent01 from './CardSplitContent01.vue'

const meta: Meta<typeof CardSplitContent01> = {
  title: 'Website/Blocks/CardSplitContent01',
  component: CardSplitContent01,
  tags: ['autodocs'],
  args: {
    eyebrow: 'New Model Release',
    title: 'MINIMAX H3',
    body: 'Full multi-modal I/O, native stereo clip. Up to 2K, 5 to 15s per generation. H3 actually conditions on input audio where others overwrite or drop it.',
    primaryCta: { label: 'View Model Features', href: '#' },
    secondaryCta: { label: 'Try Workflows', href: '#' },
    tags: ['Open Weights', 'Partner Nodes'],
    videoSrc: 'https://media.comfy.org/website/minimax/hero.mp4'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithoutTags: Story = {
  args: {
    tags: undefined
  }
}

export const SingleCta: Story = {
  args: {
    secondaryCta: undefined
  }
}
