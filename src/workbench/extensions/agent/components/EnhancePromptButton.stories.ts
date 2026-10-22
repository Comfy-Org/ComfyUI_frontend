import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'

import EnhancePromptButton from './EnhancePromptButton.vue'

const meta: Meta<typeof EnhancePromptButton> = {
  title: 'Agent/EnhancePromptButton',
  component: EnhancePromptButton,
  tags: ['autodocs'],
  args: {
    loading: false,
    disabled: false,
    size: 'icon-sm',
    onClick: fn()
  },
  argTypes: {
    loading: { control: 'boolean' },
    disabled: { control: 'boolean' },
    size: {
      control: 'select',
      options: ['icon-sm', 'icon']
    }
  },
  parameters: {
    layout: 'centered'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Processing: Story = {
  args: {
    loading: true,
    disabled: true
  }
}
