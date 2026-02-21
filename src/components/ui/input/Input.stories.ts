import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Input from './Input.vue'

const meta: Meta<typeof Input> = {
  title: 'Components/Input',
  component: Input,
  tags: ['autodocs'],
  render: (args) => ({
    components: { Input },
    setup: () => ({ args }),
    template: '<Input v-bind="args" placeholder="Enter text..." />'
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
    components: { Input },
    setup: () => ({ args }),
    template: '<Input v-bind="args" placeholder="Disabled input" disabled />'
  })
}
