import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { SubscriptionInfo } from '@/composables/billing/types'
import { i18n } from '@/i18n'
import type { PreviewSubscribeResponse } from '@/platform/workspace/api/workspaceApi'
import { setBillingContextMock } from '@/storybook/mocks/useBillingContext'

import SubscriptionTransitionPreviewWorkspace from './SubscriptionTransitionPreviewWorkspace.vue'

type PreviewPlanInfo = PreviewSubscribeResponse['new_plan']

/**
 * The reactivation-disclosure banner on the single-plan change preview: a
 * cancelled-but-not-lapsed subscription resumes silently on any plan change,
 * so the banner discloses that plus the exact charge (and, above the current
 * plan's monthly total, a consent checkbox gating the confirm button). The
 * banner reads `subscription`/`isInitialized` from `useBillingContext`, not
 * from `previewData`, so each story drives it through the Storybook stub
 * (`setBillingContextMock`) rather than props.
 */
const meta: Meta<typeof SubscriptionTransitionPreviewWorkspace> = {
  title: 'Components/SubscriptionTransitionPreviewWorkspace',
  component: SubscriptionTransitionPreviewWorkspace,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [
    (story) => ({
      components: { story },
      template:
        '<div class="mx-auto flex h-[680px] w-[460px] flex-col rounded-2xl border border-border-default bg-secondary-background p-12"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

const TODAY = '2026-08-01T00:00:00Z'
// The date the pre-existing cancellation was set to lapse; still active until
// then, which is what makes a plan change on this subscription a reactivation.
const CANCEL_DATE = '2026-08-25T00:00:00Z'
const NEXT_MONTHLY_RENEWAL = '2026-09-01T00:00:00Z'
const NEXT_ANNUAL_RENEWAL = '2027-08-01T00:00:00Z'
const NEXT_MONTHLY_AFTER_CANCEL = '2026-09-25T00:00:00Z'

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

function cancelledSubscription(
  tier: NonNullable<SubscriptionInfo['tier']>,
  duration: NonNullable<SubscriptionInfo['duration']> = 'MONTHLY'
): SubscriptionInfo {
  return {
    isActive: true,
    tier,
    duration,
    planSlug: `${tier.toLowerCase()}-${duration.toLowerCase()}`,
    renewalDate: null,
    endDate: CANCEL_DATE,
    isCancelled: true,
    hasFunds: true
  }
}

const notCancelledSubscription: SubscriptionInfo = {
  isActive: true,
  tier: 'STANDARD',
  duration: 'MONTHLY',
  planSlug: 'standard-monthly',
  renewalDate: NEXT_MONTHLY_RENEWAL,
  endDate: null,
  isCancelled: false,
  hasFunds: true
}

function story(
  previewData: PreviewSubscribeResponse,
  subscription: SubscriptionInfo
): Story {
  return {
    args: { previewData },
    beforeEach() {
      // Dates render through both a local Intl formatter and vue-i18n's n(),
      // so pin the locale rather than inherit the developer's.
      i18n.global.locale.value = 'en'
      setBillingContextMock({ subscription })
    }
  }
}

/**
 * Ordinary upgrade, subscription not cancelled — the reactivation banner
 * must not leak into a normal plan change.
 */
export const NotCancelled: Story = story(
  {
    allowed: true,
    transition_type: 'upgrade',
    effective_at: TODAY,
    is_immediate: true,
    cost_today_cents: 1500,
    cost_next_period_cents: 3500,
    credits_today_cents: 0,
    credits_next_period_cents: 0,
    current_plan: plan('STANDARD', 'MONTHLY', 2000, NEXT_MONTHLY_RENEWAL),
    new_plan: plan('CREATOR', 'MONTHLY', 3500, NEXT_MONTHLY_RENEWAL)
  } satisfies PreviewSubscribeResponse,
  notCancelledSubscription
)

/**
 * Cancelled, immediate upgrade — exact-cents charge ($54.54), guarding the
 * regression where this path rounded the charge shown to the user.
 */
export const ReactivatingUpgrade: Story = story(
  {
    allowed: true,
    transition_type: 'upgrade',
    effective_at: TODAY,
    is_immediate: true,
    cost_today_cents: 5454,
    cost_next_period_cents: 10_000,
    credits_today_cents: 0,
    credits_next_period_cents: 0,
    current_plan: plan('CREATOR', 'MONTHLY', 3500, CANCEL_DATE),
    new_plan: plan('PRO', 'MONTHLY', 10_000, NEXT_MONTHLY_RENEWAL)
  } satisfies PreviewSubscribeResponse,
  cancelledSubscription('CREATOR')
)

/**
 * Cancelled, scheduled downgrade — $0 today. The most important state: no
 * money moves, so the copy alone must make the reactivation unmissable.
 */
export const ReactivatingDowngrade: Story = story(
  {
    allowed: true,
    transition_type: 'downgrade',
    effective_at: CANCEL_DATE,
    is_immediate: false,
    cost_today_cents: 0,
    cost_next_period_cents: 3500,
    credits_today_cents: 0,
    credits_next_period_cents: 0,
    current_plan: plan('PRO', 'MONTHLY', 10_000, CANCEL_DATE),
    new_plan: plan('CREATOR', 'MONTHLY', 3500, NEXT_MONTHLY_AFTER_CANCEL)
  } satisfies PreviewSubscribeResponse,
  cancelledSubscription('PRO')
)

/** Cancelled, monthly-to-annual — the full year is billed today. */
export const ReactivatingMonthlyToAnnual: Story = story(
  {
    allowed: true,
    transition_type: 'duration_change',
    effective_at: TODAY,
    is_immediate: true,
    cost_today_cents: 33_600,
    cost_next_period_cents: 33_600,
    credits_today_cents: 0,
    credits_next_period_cents: 0,
    current_plan: plan('CREATOR', 'MONTHLY', 3500, CANCEL_DATE),
    new_plan: plan('CREATOR', 'ANNUAL', 33_600, NEXT_ANNUAL_RENEWAL)
  } satisfies PreviewSubscribeResponse,
  cancelledSubscription('CREATOR')
)

/**
 * Cancelled, annual-to-monthly — the other cadence direction, which used to
 * wrongly show the annual copy and now has its own wording.
 */
export const ReactivatingAnnualToMonthly: Story = story(
  {
    allowed: true,
    transition_type: 'duration_change',
    effective_at: TODAY,
    is_immediate: true,
    cost_today_cents: 1234,
    cost_next_period_cents: 3500,
    credits_today_cents: 0,
    credits_next_period_cents: 0,
    current_plan: plan('CREATOR', 'ANNUAL', 33_600, CANCEL_DATE),
    new_plan: plan('CREATOR', 'MONTHLY', 3500, NEXT_MONTHLY_RENEWAL)
  } satisfies PreviewSubscribeResponse,
  cancelledSubscription('CREATOR', 'ANNUAL')
)

/**
 * Cancelled, charge above the current plan's monthly total — the consent
 * checkbox renders and the confirm button stays disabled until it's ticked.
 */
export const ReactivatingAboveThreshold: Story = story(
  {
    allowed: true,
    transition_type: 'upgrade',
    effective_at: TODAY,
    is_immediate: true,
    cost_today_cents: 8000,
    cost_next_period_cents: 10_000,
    credits_today_cents: 0,
    credits_next_period_cents: 0,
    current_plan: plan('STANDARD', 'MONTHLY', 2000, CANCEL_DATE),
    new_plan: plan('PRO', 'MONTHLY', 10_000, NEXT_MONTHLY_RENEWAL)
  } satisfies PreviewSubscribeResponse,
  cancelledSubscription('STANDARD')
)
