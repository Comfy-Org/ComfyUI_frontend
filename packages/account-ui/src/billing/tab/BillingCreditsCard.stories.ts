import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { PlanCreditsState } from '@comfyorg/account-core/billing'

import BillingCreditsCard from './BillingCreditsCard.vue'
import { creditsCardCopy } from './__fixtures__/creditsCardCopy'

const PLAN: PlanCreditsState = {
  kind: 'plan',
  availableCents: 700,
  planCents: 400,
  planPoolCredits: 1000,
  topUpCents: 300,
  topUpInUse: false,
  showUsage: true,
  planDate: { kind: 'refills', date: '2026-10-01T00:00:00Z' }
}

const meta: Meta<typeof BillingCreditsCard> = {
  title: 'Account UI/Billing/BillingCreditsCard',
  component: BillingCreditsCard,
  tags: ['autodocs'],
  args: {
    copy: creditsCardCopy,
    locale: 'en',
    addCredits: { kind: 'enabled' },
    planCreditNote: null,
    state: PLAN
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

export const Plan: Story = {}

export const TopUpInUse: Story = {
  args: {
    state: {
      ...PLAN,
      availableCents: 1000,
      planCents: 0,
      topUpCents: 1000,
      topUpInUse: true
    }
  }
}

export const PausedAfterPayment: Story = {
  args: {
    state: {
      ...PLAN,
      planCents: 0,
      showUsage: false,
      planDate: { kind: 'afterPayment' }
    }
  }
}

export const AvailableUntil: Story = {
  args: {
    state: {
      ...PLAN,
      planDate: { kind: 'availableUntil', date: '2026-12-31T12:00:00Z' }
    }
  }
}

export const NoPlan: Story = {
  args: {
    state: { kind: 'noPlan', availableCents: 200 },
    planCreditNote:
      "Buying credits doesn't start a Cloud plan. Subscribe to run workflows on Cloud."
  }
}

export const Unavailable: Story = {
  args: { state: { kind: 'unavailable' } }
}

export const AddCreditsDisabled: Story = {
  args: {
    addCredits: {
      kind: 'disabled',
      reasonKey: 'credits.addCreditsRefusal.paymentPastDue'
    }
  }
}

export const AddCreditsHidden: Story = {
  args: { addCredits: { kind: 'hidden' } }
}

export const AddCreditsInverted: Story = {
  args: {
    addCreditsVariant: 'inverted',
    state: { kind: 'noPlan', availableCents: 0 }
  }
}

export const PlatformRestyled: Story = {
  args: {
    classes: {
      surface: 'rounded-md border-dashed',
      planMeter: 'h-2',
      addCredits: 'max-w-none'
    }
  }
}
