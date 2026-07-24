import type { Meta, StoryObj } from '@storybook/vue3-vite'

import PaymentDeclinedDialogContent from './PaymentDeclinedDialogContent.vue'

const meta: Meta<typeof PaymentDeclinedDialogContent> = {
  title: 'Platform/Workspace/PaymentDeclinedDialogContent',
  component: PaymentDeclinedDialogContent,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' }
  },
  globals: { theme: 'dark' },
  args: {
    reason: 'Insufficient funds'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Subscription: Story = {
  args: {
    origin: 'subscription'
  }
}

export const TopUp: Story = {
  args: {
    origin: 'topup'
  }
}
