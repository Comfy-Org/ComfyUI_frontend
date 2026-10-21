import type { BillingSubscriptionStatus } from '@/platform/workspace/api/workspaceApi'

/** The Credits-card plan note for today's Add credits amount step. Cloud only. */
export function topUpPlanCreditHint(facts: {
  isCloud: boolean
  subscriptionStatus: BillingSubscriptionStatus | null
}): 'subscribe' | 'resubscribe' | null {
  if (!facts.isCloud) return null
  if (facts.subscriptionStatus === null) return 'subscribe'
  if (facts.subscriptionStatus === 'ended') return 'resubscribe'
  return null
}
