import type { BillingSubscriptionStatus } from '@/platform/workspace/api/workspaceApi'

/** Add credits line when Cloud has no active plan. */
export function topUpPlanCreditLine(facts: {
  isCloud: boolean
  isBillingInitialized: boolean
  subscriptionStatus: BillingSubscriptionStatus | null
}): 'planRequiredSubscribe' | 'planRequiredResubscribe' | null {
  if (!facts.isCloud || !facts.isBillingInitialized) return null
  if (facts.subscriptionStatus === null) return 'planRequiredSubscribe'
  if (facts.subscriptionStatus === 'ended') return 'planRequiredResubscribe'
  return null
}
