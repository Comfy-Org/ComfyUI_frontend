import type { Meta, StoryObj } from '@storybook/vue3-vite'

import BillingPlanRow from './BillingPlanRow.vue'
import { planRowCopy } from './__fixtures__/copy'

const meta: Meta<typeof BillingPlanRow> = {
  title: 'Account UI/Billing/BillingPlanRow',
  component: BillingPlanRow,
  tags: ['autodocs'],
  args: {
    copy: planRowCopy,
    locale: 'en',
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
      nextInvoice: '2026-11-20T00:00:00Z',
      scheduledChange: null
    }
  }
}

export const Ending: Story = {
  args: {
    state: {
      kind: 'ending',
      planName: 'Pro',
      cadence: 'monthly',
      endsAt: '2026-11-20T00:00:00Z'
    }
  }
}

export const Paused: Story = {
  args: { state: { kind: 'paused', planName: 'Pro' } }
}

export const NoPlan: Story = {
  args: {
    action: 'subscribe',
    state: { kind: 'noPlan', freeRuns: { remaining: 3, total: 5 } }
  }
}

export const ContactSales: Story = {
  args: {
    action: 'contactSales',
    state: {
      kind: 'salesManaged',
      planName: 'Enterprise',
      cadence: 'yearly',
      renewsAt: '2027-03-01T00:00:00Z'
    }
  }
}

export const MemberView: Story = {
  args: {
    canManageSubscription: false,
    action: null,
    state: { kind: 'paused', planName: 'Pro' }
  }
}

export const PlatformRestyled: Story = {
  args: {
    classes: { root: 'rounded-md border-dashed' },
    state: {
      kind: 'active',
      planName: 'Pro',
      cadence: 'monthly',
      nextInvoice: '2026-11-20T00:00:00Z',
      scheduledChange: null
    }
  }
}
