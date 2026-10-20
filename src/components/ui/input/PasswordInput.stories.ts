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
  render: () => ({
    components: { PasswordInput },
    template:
      '<PasswordInput aria-label="Password" placeholder="Enter password" hide-password-label="Hide password" show-password-label="Show password" disabled />'
  })
}

export const Invalid: Story = {
  render: () => ({
    components: { PasswordInput },
    template:
      '<PasswordInput aria-label="Password" placeholder="Enter password" hide-password-label="Hide password" show-password-label="Show password" aria-invalid="true" />'
  })
}
