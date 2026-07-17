import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { SubscriptionInfo } from '@/composables/billing/types'
import { i18n } from '@/i18n'
import type { BillingContextMockState } from '@/storybook/mocks/useBillingContext'
import { setBillingContextMock } from '@/storybook/mocks/useBillingContext'
import type { WorkspaceUIMockState } from '@/storybook/mocks/useWorkspaceUI'
import { setWorkspaceUIMock } from '@/storybook/mocks/useWorkspaceUI'

import BillingStatusBanner from './BillingStatusBanner.vue'

/**
 * The single billing banner slot for team workspaces (FE-1246), rendered in
 * priority order: paused > payment declined > out of credits > ending. At most
 * one state shows at a time. Each story drives the real `deriveBillingBanner`
 * through the stubbed billing context, so these are the states the backend can
 * actually emit — not hand-set banner kinds.
 *
 * The amber triangle-alert marks action-needed states; the muted circle-alert is
 * reserved for the informational "plan ends" notice (DES-380 severity rule).
 *
 * RUN WITH `DISTRIBUTION=cloud pnpm storybook`. The banner is cloud-only, and
 * `isCloud` is compile-time, so under a plain `pnpm storybook` every story below
 * renders empty.
 */
const meta: Meta<typeof BillingStatusBanner> = {
  title: 'Platform/Workspace/BillingStatusBanner',
  component: BillingStatusBanner,
  parameters: { layout: 'fullscreen' }
}

export default meta
type Story = StoryObj<typeof BillingStatusBanner>

const RENEWAL_DATE = '2026-08-01T00:00:00Z'
const PLAN_END_DATE = '2026-08-01T00:00:00Z'

const teamSubscription: SubscriptionInfo = {
  isActive: true,
  tier: null,
  duration: 'MONTHLY',
  planSlug: 'team-monthly',
  renewalDate: RENEWAL_DATE,
  endDate: null,
  isCancelled: false,
  hasFunds: true
}

const funded = teamSubscription
const exhausted: SubscriptionInfo = { ...teamSubscription, hasFunds: false }
const cancelled: SubscriptionInfo = {
  ...teamSubscription,
  isCancelled: true,
  endDate: PLAN_END_DATE
}

const owner: Partial<WorkspaceUIMockState> = {}
const member: Partial<WorkspaceUIMockState> = {
  canManageSubscription: false,
  canManageSubscriptionLifecycle: false,
  canTopUp: false
}

function story(
  billing: Partial<BillingContextMockState>,
  workspace: Partial<WorkspaceUIMockState>
): Story {
  return {
    beforeEach() {
      // Dates in the copy go through vue-i18n's `d()`, so pin the locale rather
      // than inherit the developer's.
      i18n.global.locale.value = 'en'
      setBillingContextMock({ isTeamPlan: true, ...billing })
      setWorkspaceUIMock(workspace)
    }
  }
}

/**
 * Stripe suspended the subscription. The backend folds billing_status into
 * is_active, so a paused workspace always reports `is_active: false` — the
 * pairing these stories pin.
 */
export const PausedOwner: Story = story(
  {
    subscription: funded,
    isActiveSubscription: false,
    billingStatus: 'paused',
    subscriptionStatus: 'active'
  },
  owner
)

/** Members get an admin-directed notice and no action. */
export const PausedMember: Story = story(
  {
    subscription: funded,
    isActiveSubscription: false,
    billingStatus: 'paused',
    subscriptionStatus: 'active'
  },
  member
)

/**
 * A failed charge with Stripe still retrying. Owner-only, and `is_active: false`
 * for the same reason paused is — payment_failed also denies spend.
 */
export const PaymentDeclined: Story = story(
  {
    subscription: funded,
    isActiveSubscription: false,
    billingStatus: 'payment_failed',
    subscriptionStatus: 'active',
    renewalDate: RENEWAL_DATE
  },
  owner
)

/** Payment declined before a renewal date is known. */
export const PaymentDeclinedNoDate: Story = story(
  {
    subscription: funded,
    isActiveSubscription: false,
    billingStatus: 'payment_failed',
    subscriptionStatus: 'active'
  },
  owner
)

/** Shared team credits exhausted. Session-dismissible. */
export const OutOfCreditsOwner: Story = story(
  {
    subscription: exhausted,
    isActiveSubscription: true,
    billingStatus: 'paid',
    subscriptionStatus: 'active',
    renewalDate: RENEWAL_DATE
  },
  owner
)

/** Members can't top up, so they get contact-admin copy and no Add credits. */
export const OutOfCreditsMember: Story = story(
  {
    subscription: exhausted,
    isActiveSubscription: true,
    billingStatus: 'paid',
    subscriptionStatus: 'active',
    renewalDate: RENEWAL_DATE
  },
  member
)

/** Cancelled but still active until the period end. Informational. */
export const EndingOwner: Story = story(
  {
    subscription: cancelled,
    isActiveSubscription: true,
    billingStatus: 'paid',
    subscriptionStatus: 'canceled'
  },
  owner
)

/**
 * Reactivate is lifecycle-gated to the original owner, so a non-original owner
 * sees the notice read-only.
 */
export const EndingNonOriginalOwner: Story = story(
  {
    subscription: cancelled,
    isActiveSubscription: true,
    billingStatus: 'paid',
    subscriptionStatus: 'canceled'
  },
  { canManageSubscriptionLifecycle: false }
)
