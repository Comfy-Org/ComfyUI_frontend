import type { PlanKind } from '@comfyorg/account-core/billing'
import type { SubscriptionState } from '@comfyorg/ingest-types'

type TopUpPlanCreditLine =
  | 'planRequiredFreeRuns'
  | 'planRequiredSubscribe'
  | 'planRequiredResubscribe'

export type PlanCreditLine = TopUpPlanCreditLine | 'planRequiredContactSales'

interface TopUpPlanCreditFacts {
  isCloud: boolean
  isBillingInitialized: boolean
  canTopUp: boolean
  subscriptionState: SubscriptionState | null
  freeRunsRemaining: number
}

/** Add credits line on Cloud for a served `subscription_state` that has no plan. */
export function topUpPlanCreditLine(
  facts: TopUpPlanCreditFacts
): TopUpPlanCreditLine | null {
  if (!facts.isCloud) return null
  if (!facts.isBillingInitialized) return null
  if (!facts.canTopUp) return null
  if (facts.subscriptionState === 'never_subscribed') {
    if (facts.freeRunsRemaining > 0) return 'planRequiredFreeRuns'
    return 'planRequiredSubscribe'
  }
  if (facts.subscriptionState === 'ended') return 'planRequiredResubscribe'
  return null
}

/** The same line, sending an ended plan to sales when the served `plan_kind` is `sales_managed`. */
export function planCreditLine(
  facts: TopUpPlanCreditFacts & { planKind: PlanKind | null }
): PlanCreditLine | null {
  const line = topUpPlanCreditLine(facts)
  return line === 'planRequiredResubscribe' &&
    facts.planKind === 'sales_managed'
    ? 'planRequiredContactSales'
    : line
}
