import type { Meta, StoryObj } from '@storybook/vue3-vite'

import TopUpCreditsDialogContent from './TopUpCreditsDialogContent.vue'

interface TopUpCreditsStoryArgs {
  useNewCreditsDesign?: boolean
  refreshDate?: string
}

const meta: Meta<TopUpCreditsStoryArgs> = {
  title: 'Components/Dialog/TopUpCreditsDialogContent',
  component: TopUpCreditsDialogContent,
  argTypes: {
    useNewCreditsDesign: {
      control: 'boolean',
      description: 'Use new credits design (defaults to true when undefined)'
    },
    refreshDate: {
      control: 'text',
      description: 'Date when credits refresh'
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    useNewCreditsDesign: true,
    refreshDate: 'Dec 16, 2025'
  }
}

export const WithoutRefreshDate: Story = {
  args: {
    useNewCreditsDesign: true,
    refreshDate: undefined
  }
}

export const DefaultBehavior: Story = {
  args: {
    useNewCreditsDesign: undefined, // This should default to true
    refreshDate: 'Jan 15, 2026'
  }
}
