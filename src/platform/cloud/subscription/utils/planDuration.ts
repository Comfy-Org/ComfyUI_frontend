import type { SubscriptionDuration } from '@/platform/workspace/api/workspaceApi'

import type { BillingCycle } from './subscriptionTierRank'

/** Backend plan duration `'ANNUAL'` maps to the FE's yearly billing cycle. */
export const isAnnualDuration = (
  duration: SubscriptionDuration | undefined
): boolean => duration === 'ANNUAL'

/**
 * Whether a checkout step renders as yearly. The preview's resolved plan
 * duration wins; absent a preview (fresh subscribe with no proration) it falls
 * back to the user's selected billing cycle.
 */
export const isYearlyCheckout = (
  planDuration: SubscriptionDuration | undefined,
  billingCycle: BillingCycle
): boolean =>
  planDuration !== undefined
    ? isAnnualDuration(planDuration)
    : billingCycle === 'yearly'
