import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Loader from './Loader.vue'

const meta: Meta<typeof Loader> = {
  title: 'Components/Loader/Loader',
  component: Loader,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered'
  },
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Spinner size: sm (16px), md (32px), lg (48px)'
    },
    variant: {
      control: 'select',
      options: ['loader', 'loader-circle'],
      description: 'The type of loader displayed'
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
    components: { Loader },
    setup() {
      return { args }
    },
    template:
      '<div class="flex gap-4 items-center"><Loader size="lg" class="text-white" /><Loader size="md" class="text-muted-foreground" /><Loader size="sm" class="text-base-foreground" /></div>'
  }),
  parameters: {
    backgrounds: { default: 'dark' }
  }
}
