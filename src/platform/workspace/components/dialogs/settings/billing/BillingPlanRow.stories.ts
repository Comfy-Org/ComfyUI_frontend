import type { Meta, StoryObj } from '@storybook/vue3-vite'

import BillingPlanRow from './BillingPlanRow.vue'

const meta: Meta<typeof BillingPlanRow> = {
  title: 'Platform/Workspace/BillingPlanRow',
  component: BillingPlanRow,
  tags: ['autodocs'],
  args: {
    canManageSubscription: true,
    action: 'manage'
  },
  decorators: [
    (story) => ({
      components: { story },
      template: '<div class="w-[720px] bg-background p-6"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Active: Story = {
  args: {
    state: {
      kind: 'active',
      planName: 'Pro',
      cadence: 'monthly',
      nextInvoice: '2026-11-15T00:00:00Z',
      scheduledChange: null
    }
  }
}

export const Activating: Story = {
  args: {
    state: { kind: 'activating', planName: 'Pro' }
  }
}
