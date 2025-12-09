import type { Meta, StoryObj } from '@storybook/vue3-vite'

import TopUpCreditsDialogContent from './TopUpCreditsDialogContent.vue'

interface TopUpCreditsStoryArgs {
  refreshDate?: string
}

const meta: Meta<TopUpCreditsStoryArgs> = {
  title: 'Components/Dialog/TopUpCreditsDialogContent',
  component: TopUpCreditsDialogContent,
  argTypes: {
    refreshDate: {
      control: 'text',
      description: 'Date when credits refresh'
    }
  },
  parameters: {
    docs: {
      description: {
        component:
          'Credit top-up dialog content. Design is controlled by the `subscription_tiers_enabled` feature flag (defaults to new design).'
      }
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    refreshDate: 'Dec 16, 2025'
  }
}

export const WithoutRefreshDate: Story = {
  args: {
    refreshDate: undefined
  }
}
