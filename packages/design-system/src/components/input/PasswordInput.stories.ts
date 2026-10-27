import type { Meta, StoryObj } from '@storybook/vue3-vite'

import PasswordInput from './PasswordInput.vue'

const meta: Meta<typeof PasswordInput> = {
  title: 'Components/PasswordInput',
  component: PasswordInput,
  tags: ['autodocs'],
  args: {
    hidePasswordLabel: 'Hide password',
    showPasswordLabel: 'Show password'
  },
  render: (args) => ({
    components: { PasswordInput },
    setup: () => ({ args }),
    template:
      '<PasswordInput v-bind="args" aria-label="Password" placeholder="Enter password" />'
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Disabled: Story = {
  render: (args) => ({
    components: { PasswordInput },
    setup: () => ({ args }),
    template:
      '<PasswordInput v-bind="args" aria-label="Password" placeholder="Enter password" disabled />'
  })
}

export const Invalid: Story = {
  render: (args) => ({
    components: { PasswordInput },
    setup: () => ({ args }),
    template:
      '<PasswordInput v-bind="args" aria-label="Password" placeholder="Enter password" aria-invalid="true" />'
  })
}
