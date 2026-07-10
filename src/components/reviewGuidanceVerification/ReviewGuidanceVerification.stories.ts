import type { Meta, StoryObj } from '@storybook/vue3-vite'

import ReviewGuidanceVerification from './ReviewGuidanceVerification.vue'

const meta: Meta<typeof ReviewGuidanceVerification> = {
  title: 'Verification/Review Guidance',
  component: ReviewGuidanceVerification,
  args: {
    disabled: false,
    loading: false
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
