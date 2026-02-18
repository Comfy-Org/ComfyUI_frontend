import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Textarea from './Textarea.vue'

const meta: Meta<typeof Textarea> = {
  title: 'Components/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  render: (args) => ({
    components: { Textarea },
    setup: () => ({ args }),
    template: '<Textarea v-bind="args" placeholder="Enter text..." />'
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithValue: Story = {
  args: {
    modelValue: 'Hello, world!'
  }
}

export const Disabled: Story = {
  render: (args) => ({
    components: { Textarea },
    setup: () => ({ args }),
    template:
      '<Textarea v-bind="args" placeholder="Disabled textarea" disabled />'
  })
}
