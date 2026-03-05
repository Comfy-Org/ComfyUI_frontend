import type { Meta, StoryObj } from '@storybook/vue3-vite'

import LoadingSpinner from './LoadingSpinner.vue'

const meta: Meta<typeof LoadingSpinner> = {
  title: 'Components/Common/LoadingSpinner',
  component: LoadingSpinner,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered'
  },
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Spinner size: sm (16px), md (32px), lg (48px)'
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Small: Story = {
  args: { size: 'sm' }
}

export const Medium: Story = {
  args: { size: 'md' }
}

export const Large: Story = {
  args: { size: 'lg' }
}

export const CustomColor: Story = {
  render: (args) => ({
    components: { LoadingSpinner },
    setup() {
      return { args }
    },
    template:
      '<div class="flex gap-4 items-center"><LoadingSpinner size="lg" class="text-white" /><LoadingSpinner size="md" class="text-muted-foreground" /><LoadingSpinner size="sm" class="text-base-foreground" /></div>'
  }),
  parameters: {
    backgrounds: { default: 'dark' }
  }
}
