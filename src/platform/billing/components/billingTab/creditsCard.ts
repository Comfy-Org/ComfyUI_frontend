import type { BalanceInfo } from '@/platform/billing/composables/types'
import type { BillingStatus } from '@/platform/workspace/api/workspaceApi'
import type { PlanRowState } from '@/platform/billing/components/billingTab/planRow'

export interface CreditsCardFacts {
  balance: BalanceInfo | null
  planKind: PlanRowState['kind']
  billingStatus: BillingStatus | null
  planPoolCredits: number | null
  renewalDate: string | null
}

export type CreditsCardState =
  | { kind: 'unavailable' }
  | { kind: 'noPlan'; availableCents: number }
  | {
      kind: 'plan'
      availableCents: number
      planCents: number
      planPoolCredits: number | null
      topUpCents: number
      topUpInUse: boolean
      renewalDate: string | null
    }

/** Maps the served balance and plan state onto the Credits card. */
export function deriveCreditsCard(facts: CreditsCardFacts): CreditsCardState {
  const { balance } = facts
  if (!balance || balance.effectiveBalanceAuthoritative === false) {
    return { kind: 'unavailable' }
  }
  const availableCents = balance.effectiveBalanceMicros ?? balance.amountMicros

  if (facts.planKind === 'noPlan' || facts.planKind === 'ended') {
    return { kind: 'noPlan', availableCents }
  }

  const overdrawn = availableCents < 0
  const planCents = overdrawn ? 0 : (balance.cloudCreditBalanceMicros ?? 0)
  const topUpCents = overdrawn ? 0 : (balance.prepaidBalanceMicros ?? 0)
  return {
    kind: 'plan',
    availableCents,
    planCents: facts.billingStatus === 'paused' ? 0 : planCents,
    planPoolCredits: facts.planPoolCredits,
    topUpCents,
    topUpInUse: planCents === 0 && topUpCents > 0,
    renewalDate: facts.renewalDate
  }
}
