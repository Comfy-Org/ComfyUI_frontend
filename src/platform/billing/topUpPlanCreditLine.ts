import type { SubscriptionState } from '@comfyorg/ingest-types'

/** Add credits line on Cloud for a served `subscription_state` that has no plan. */
export function topUpPlanCreditLine(facts: {
  isCloud: boolean
  isBillingInitialized: boolean
  canTopUp: boolean
  subscriptionState: SubscriptionState | null
}): 'planRequiredSubscribe' | 'planRequiredResubscribe' | null {
  if (!facts.isCloud) return null
  if (!facts.isBillingInitialized) return null
  if (!facts.canTopUp) return null
  if (facts.subscriptionState === 'never_subscribed') {
    return 'planRequiredSubscribe'
  }
  if (facts.subscriptionState === 'ended') return 'planRequiredResubscribe'
  return null
}
