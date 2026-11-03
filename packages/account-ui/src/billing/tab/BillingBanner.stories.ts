import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'

import BillingBanner from './BillingBanner.vue'
import { billingBannerCopy } from './__fixtures__/bannerCopy'

const meta: Meta<typeof BillingBanner> = {
  title: 'Account UI/Billing/BillingBanner',
  component: BillingBanner,
  tags: ['autodocs'],
  argTypes: {
    addCreditsVariant: { control: 'select', options: ['secondary', 'inverted'] }
  },
  args: { copy: billingBannerCopy, onAction: fn(), onDismiss: fn() },
  decorators: [
    (story) => ({
      components: { story },
      template: '<div class="w-[720px] bg-background p-6"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Paused: Story = {
  args: {
    view: {
      kind: 'paused',
      title: 'Subscription paused',
      body: "This workspace's subscription is paused. Update payment to resume.",
      muted: false,
      action: 'updatePayment'
    }
  }
}

export const PlanCheckout: Story = {
  args: {
    view: {
      kind: 'planCheckout',
      ...billingBannerCopy.planCheckout.verifyPayment,
      muted: false,
      action: 'verifyPayment',
      href: 'https://pay.example/verify',
      dismissKey: null
    }
  }
}

export const TopupCheckout: Story = {
  args: {
    view: {
      kind: 'topupCheckout',
      title: billingBannerCopy.topupCheckout.failedTitle(2500),
      body: billingBannerCopy.topupCheckout.failedBody,
      action: 'addCredits',
      dismissKey: 'cs_1:failed'
    }
  }
}

export const Parked: Story = {
  args: {
    view: {
      kind: 'parked',
      title: 'Something went wrong with a recent payment',
      body: 'Contact support so we can fix it.',
      action: 'contactSupport',
      href: 'https://comfy.org/contact/'
    }
  }
}

export const PlanStatus: Story = {
  args: {
    view: {
      kind: 'planStatus',
      title: 'Your Team plan ends on November 20, 2026',
      body: "You won't be charged again. Members keep full access until then. Resume your plan to keep your team's shared credits."
    }
  }
}

export const AutoTopUp: Story = {
  args: {
    view: {
      kind: 'autoTopUp',
      title: 'Auto top-up failed',
      body: "Your auto top-up charge didn't go through. Update your payment method or add credits manually.",
      action: 'updatePayment',
      href: 'https://platform.comfy.org/profile/billing'
    }
  }
}

export const Credit: Story = {
  args: {
    view: {
      kind: 'credit',
      title: 'Out of credits',
      body: "You've used all your credits. Add more credits.",
      action: 'addCredits',
      dismissKey: 'outOfCredits'
    }
  }
}

export const PlatformRestyled: Story = {
  args: {
    addCreditsVariant: 'inverted',
    classes: { panel: 'rounded-md border-dashed' },
    view: {
      kind: 'credit',
      title: 'Credits are low',
      body: 'You have 120 credits left. Add credits before you run out.',
      action: 'addCredits',
      dismissKey: 'lowCredits'
    }
  }
}
