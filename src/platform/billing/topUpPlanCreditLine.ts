import type { BillingSubscriptionStatus } from '@/platform/workspace/api/workspaceApi'

/** M4 Add credits line when Cloud has no active plan. */
export function topUpPlanCreditLine(facts: {
  unifiedBillingSettingsEnabled: boolean
  isCloud: boolean
  subscriptionStatus: BillingSubscriptionStatus | null
}): 'planRequiredSubscribe' | 'planRequiredResubscribe' | null {
  if (!facts.unifiedBillingSettingsEnabled || !facts.isCloud) return null
  if (facts.subscriptionStatus === null) return 'planRequiredSubscribe'
  if (facts.subscriptionStatus === 'ended') return 'planRequiredResubscribe'
  return null
}
