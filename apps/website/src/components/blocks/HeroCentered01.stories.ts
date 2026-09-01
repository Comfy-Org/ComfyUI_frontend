import type { Meta, StoryObj } from '@storybook/vue3-vite'

import HeroCentered01 from './HeroCentered01.vue'

const meta: Meta<typeof HeroCentered01> = {
  title: 'Website/Blocks/HeroCentered01',
  component: HeroCentered01,
  tags: ['autodocs'],
  args: {
    eyebrow: 'EVENTS',
    title: 'Creators, all in one place',
    subtitle: 'Livestreams and hackathons we run. Community events worldwide.'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithoutEyebrow: Story = {
  args: {
    eyebrow: undefined
  }
}

export const TitleOnly: Story = {
  args: {
    eyebrow: undefined,
    subtitle: undefined
  }
}
