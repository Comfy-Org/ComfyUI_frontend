import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { PreviewSubscribeResponse } from '@/platform/workspace/api/workspaceApi'

import SubscriptionAddPaymentPreviewWorkspace from './SubscriptionAddPaymentPreviewWorkspace.vue'
import SubscriptionSuccessWorkspace from './SubscriptionSuccessWorkspace.vue'
import SubscriptionTransitionPreviewWorkspace from './SubscriptionTransitionPreviewWorkspace.vue'

type PreviewPlanInfo = PreviewSubscribeResponse['new_plan']

/**
 * Checkout steps of the unified subscription dialog (FE-934): the
 * "Confirm your payment" (new subscription), the single-plan plan-change
 * confirm (immediate upgrade / scheduled downgrade), and the success screen.
 * Driven by props (no API in Storybook). `price_cents` is the full
 * billing-period total — yearly headlines divide it by 12.
 */
const meta: Meta = {
  title: 'Components/SubscriptionCheckoutSteps',
  parameters: { layout: 'centered' }
}

export default meta
type Story = StoryObj

const TODAY = '2026-06-19T00:00:00Z'
const NEXT_YEAR = '2027-06-28T00:00:00Z'
const PERIOD_END = '2027-06-28T00:00:00Z'

function plan(
  tier: PreviewPlanInfo['tier'],
  duration: PreviewPlanInfo['duration'],
  priceCents: number,
  periodEnd: string
): PreviewPlanInfo {
  return {
    slug: `${tier.toLowerCase()}-${duration.toLowerCase()}`,
    tier,
    duration,
    price_cents: priceCents,
    credits_cents: 0,
    seat_summary: {
      seat_count: 1,
      total_cost_cents: priceCents,
      total_credits_cents: 0
    },
    period_end: periodEnd
  }
}

const creatorMonthly = plan('CREATOR', 'MONTHLY', 3500, NEXT_YEAR)
const creatorAnnual = plan('CREATOR', 'ANNUAL', 33_600, NEXT_YEAR)
const proMonthly = plan('PRO', 'MONTHLY', 10_000, PERIOD_END)

const shell =
  '<div class="mx-auto flex h-[680px] w-[460px] flex-col rounded-2xl border border-border-default bg-secondary-background p-12">'

function transitionStory(previewData: PreviewSubscribeResponse): Story {
  return {
    render: () => ({
      components: { SubscriptionTransitionPreviewWorkspace },
      data: () => ({ previewData }),
      template: `${shell}<SubscriptionTransitionPreviewWorkspace :preview-data="previewData" /></div>`
    })
  }
}

/** New subscription — "Confirm your payment" (AddPayment, Creator yearly). */
export const ConfirmNewSubscription: Story = {
  render: () => ({
    components: { SubscriptionAddPaymentPreviewWorkspace },
    data: () => ({
      previewData: {
        allowed: true,
        transition_type: 'new_subscription',
        effective_at: TODAY,
        is_immediate: true,
        cost_today_cents: 33_600,
        cost_next_period_cents: 33_600,
        credits_today_cents: 0,
        credits_next_period_cents: 0,
        new_plan: creatorAnnual
      } satisfies PreviewSubscribeResponse
    }),
    template: `${shell}<SubscriptionAddPaymentPreviewWorkspace tier-key="creator" billing-cycle="yearly" :preview-data="previewData" /></div>`
  })
}

/** Team subscription — "Confirm your payment" rendered from a slider stop. */
export const ConfirmTeamSubscription: Story = {
  render: () => ({
    components: { SubscriptionAddPaymentPreviewWorkspace },
    data: () => ({
      teamPlan: { usd: 700, credits: 147_700, discountedUsd: 630 }
    }),
    template: `${shell}<SubscriptionAddPaymentPreviewWorkspace :team-plan="teamPlan" billing-cycle="yearly" /></div>`
  })
}

/**
 * Team credit-commit change — team_700 → team_1400 monthly (prorated). Plan name
 * and refill credits come from the slider stop; the proration money is driven by
 * previewData (cost_today_cents).
 */
export const ChangeTeamCreditCommit: Story = {
  render: () => ({
    components: { SubscriptionTransitionPreviewWorkspace },
    data: () => ({
      teamPlan: {
        id: 'team_1400',
        usd: 1400,
        credits: 295_400,
        discountedUsd: 1295
      },
      previewData: {
        allowed: true,
        transition_type: 'upgrade',
        effective_at: TODAY,
        is_immediate: true,
        cost_today_cents: 105_000,
        cost_next_period_cents: 140_000,
        credits_today_cents: 0,
        credits_next_period_cents: 0,
        current_plan: plan('PRO', 'MONTHLY', 70_000, NEXT_YEAR),
        new_plan: plan('PRO', 'MONTHLY', 140_000, NEXT_YEAR)
      } satisfies PreviewSubscribeResponse
    }),
    template: `${shell}<SubscriptionTransitionPreviewWorkspace :team-plan="teamPlan" :preview-data="previewData" /></div>`
  })
}

/** Immediate upgrade — Creator monthly → yearly (cadence change, prorated). */
export const UpgradeCadenceYearly: Story = transitionStory({
  allowed: true,
  transition_type: 'duration_change',
  effective_at: TODAY,
  is_immediate: true,
  cost_today_cents: 31_850,
  cost_next_period_cents: 33_600,
  credits_today_cents: 0,
  credits_next_period_cents: 0,
  current_plan: creatorMonthly,
  new_plan: creatorAnnual
} satisfies PreviewSubscribeResponse)

/** Immediate upgrade — Creator → Pro monthly (tier change, prorated). */
export const UpgradeTier: Story = transitionStory({
  allowed: true,
  transition_type: 'upgrade',
  effective_at: TODAY,
  is_immediate: true,
  cost_today_cents: 8250,
  cost_next_period_cents: 10_000,
  credits_today_cents: 0,
  credits_next_period_cents: 0,
  current_plan: creatorMonthly,
  new_plan: proMonthly
} satisfies PreviewSubscribeResponse)

/** Scheduled downgrade — Pro → Creator monthly (effective at period end). */
export const DowngradeTier: Story = transitionStory({
  allowed: true,
  transition_type: 'downgrade',
  effective_at: PERIOD_END,
  is_immediate: false,
  cost_today_cents: 0,
  cost_next_period_cents: 3500,
  credits_today_cents: 0,
  credits_next_period_cents: 0,
  current_plan: proMonthly,
  new_plan: creatorMonthly
} satisfies PreviewSubscribeResponse)

/** Scheduled downgrade — Creator yearly → monthly (cadence, period end). */
export const DowngradeCadenceMonthly: Story = transitionStory({
  allowed: true,
  transition_type: 'duration_change',
  effective_at: PERIOD_END,
  is_immediate: false,
  cost_today_cents: 0,
  cost_next_period_cents: 3500,
  credits_today_cents: 0,
  credits_next_period_cents: 0,
  current_plan: plan('CREATOR', 'ANNUAL', 33_600, PERIOD_END),
  new_plan: creatorMonthly
} satisfies PreviewSubscribeResponse)

/** Success — "You're all set". */
export const SuccessAllSet: Story = {
  render: () => ({
    components: { SubscriptionSuccessWorkspace },
    data: () => ({
      previewData: {
        allowed: true,
        transition_type: 'new_subscription',
        effective_at: TODAY,
        is_immediate: true,
        cost_today_cents: 33_600,
        cost_next_period_cents: 33_600,
        credits_today_cents: 0,
        credits_next_period_cents: 0,
        new_plan: creatorAnnual
      } satisfies PreviewSubscribeResponse
    }),
    template: `${shell}<SubscriptionSuccessWorkspace tier-key="creator" :preview-data="previewData" /></div>`
  })
}

/**
 * Team success — "You're all set" with the inline "Invite your team" block
 * (FE-965 / DES-394). Team-only: gated on a team plan + teamWorkspacesEnabled.
 */
export const TeamSuccessWithInvite: Story = {
  render: () => ({
    components: { SubscriptionSuccessWorkspace },
    data: () => ({
      teamPlan: { usd: 700, credits: 147_700, discountedUsd: 630 }
    }),
    template: `${shell}<SubscriptionSuccessWorkspace :team-plan="teamPlan" is-team /></div>`
  })
}
