import type { Meta, StoryObj } from '@storybook/vue3-vite'

import SocialProofBarSection from './SocialProofBarSection.vue'

const meta: Meta<typeof SocialProofBarSection> = {
  title: 'Website/Common/SocialProofBarSection',
  component: SocialProofBarSection,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' }
}

export default meta
type Story = StoryObj<typeof meta>

export const Desktop: Story = {}

export const Mobile: Story = {
  globals: {
    viewport: { value: 'mobile1', isRotated: false }
  }
}
