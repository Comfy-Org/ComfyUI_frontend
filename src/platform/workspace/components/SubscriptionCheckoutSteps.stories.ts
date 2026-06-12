import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { PreviewSubscribeResponse } from '@/platform/workspace/api/workspaceApi'

import SubscriptionAddPaymentPreviewWorkspace from './SubscriptionAddPaymentPreviewWorkspace.vue'
import SubscriptionSuccessWorkspace from './SubscriptionSuccessWorkspace.vue'
import SubscriptionTransitionPreviewWorkspace from './SubscriptionTransitionPreviewWorkspace.vue'

type PreviewPlanInfo = PreviewSubscribeResponse['new_plan']

/**
 * Checkout steps of the unified subscription dialog (FE-934): the
 * "Confirm your payment" / "Confirm your plan change" preview screens and the
 * "You're all set" success screen. Driven by props (no API in Storybook).
 */
const meta: Meta = {
  title: 'Components/SubscriptionCheckoutSteps',
  parameters: { layout: 'centered' }
}

export default meta
type Story = StoryObj

const creatorPlan: PreviewPlanInfo = {
  slug: 'creator-annual',
  tier: 'CREATOR',
  duration: 'ANNUAL',
  price_cents: 2800,
  credits_cents: 740000,
  seat_summary: {
    seat_count: 1,
    total_cost_cents: 2800,
    total_credits_cents: 740000
  },
  period_end: '2027-07-10T00:00:00Z'
}

const proPlan: PreviewPlanInfo = {
  slug: 'pro-annual',
  tier: 'PRO',
  duration: 'ANNUAL',
  price_cents: 8000,
  credits_cents: 2110000,
  seat_summary: {
    seat_count: 1,
    total_cost_cents: 8000,
    total_credits_cents: 2110000
  },
  period_end: '2026-07-10T00:00:00Z'
}

const shell =
  '<div class="mx-auto flex h-[680px] w-[460px] flex-col rounded-2xl border border-border-default bg-secondary-background p-12">'

/** New subscription — "Confirm your payment" (AddPayment preview). */
export const ConfirmNewSubscription: Story = {
  render: () => ({
    components: { SubscriptionAddPaymentPreviewWorkspace },
    data: () => ({
      previewData: {
        allowed: true,
        transition_type: 'new_subscription',
        effective_at: '2026-07-10T00:00:00Z',
        is_immediate: true,
        cost_today_cents: 2800,
        cost_next_period_cents: 2800,
        credits_today_cents: 740000,
        credits_next_period_cents: 740000,
        new_plan: creatorPlan
      } satisfies PreviewSubscribeResponse
    }),
    template: `${shell}<SubscriptionAddPaymentPreviewWorkspace tier-key="creator" billing-cycle="yearly" :preview-data="previewData" /></div>`
  })
}

/** Team subscription — "Confirm your payment" rendered from a slider stop. */
export const ConfirmTeamSubscription: Story = {
  render: () => ({
    components: { SubscriptionAddPaymentPreviewWorkspace },
    data: () => ({ teamPlan: { usd: 400, credits: 84_400 } }),
    template: `${shell}<SubscriptionAddPaymentPreviewWorkspace :team-plan="teamPlan" /></div>`
  })
}

/** Plan change — "Confirm your plan change" (Transition preview, Pro → Creator). */
export const ConfirmPlanChange: Story = {
  render: () => ({
    components: { SubscriptionTransitionPreviewWorkspace },
    data: () => ({
      previewData: {
        allowed: true,
        transition_type: 'downgrade',
        effective_at: '2026-07-10T00:00:00Z',
        is_immediate: false,
        cost_today_cents: 0,
        cost_next_period_cents: 2800,
        credits_today_cents: 0,
        credits_next_period_cents: 740000,
        current_plan: proPlan,
        new_plan: creatorPlan
      } satisfies PreviewSubscribeResponse
    }),
    template: `${shell}<SubscriptionTransitionPreviewWorkspace :preview-data="previewData" /></div>`
  })
}

/** Success — "You're all set". */
export const SuccessAllSet: Story = {
  render: () => ({
    components: { SubscriptionSuccessWorkspace },
    data: () => ({
      previewData: {
        allowed: true,
        transition_type: 'new_subscription',
        effective_at: '2026-07-10T00:00:00Z',
        is_immediate: true,
        cost_today_cents: 2800,
        cost_next_period_cents: 2800,
        credits_today_cents: 740000,
        credits_next_period_cents: 740000,
        new_plan: creatorPlan
      } satisfies PreviewSubscribeResponse
    }),
    template: `${shell}<SubscriptionSuccessWorkspace tier-key="creator" :preview-data="previewData" /></div>`
  })
}
