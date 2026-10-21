import type { BalanceInfo } from '@/composables/billing/types'
import type { BillingStatus } from '@/platform/workspace/api/workspaceApi'
import type { PlanRowState } from '@/platform/workspace/components/dialogs/settings/billing/planRow'

export interface CreditsCardFacts {
  balance: BalanceInfo | null
  planKind: PlanRowState['kind']
  billingStatus: BillingStatus | null
  planPoolCredits: number | null
  isCloud: boolean
}

export type CreditsCardState =
  | { kind: 'unavailable' }
  | {
      kind: 'noPlan'
      availableCents: number
      hint: 'subscribe' | 'resubscribe' | null
    }
  | {
      kind: 'plan'
      availableCents: number
      planCents: number
      planPoolCredits: number | null
      topUpCents: number
      topUpInUse: boolean
    }

/** Maps the served balance and plan state onto the Credits card. */
export function deriveCreditsCard(facts: CreditsCardFacts): CreditsCardState {
  const { balance } = facts
  if (!balance || balance.effectiveBalanceAuthoritative === false) {
    return { kind: 'unavailable' }
  }
  const availableCents = balance.effectiveBalanceMicros ?? balance.amountMicros

  if (facts.planKind === 'noPlan' || facts.planKind === 'ended') {
    const hint = facts.planKind === 'noPlan' ? 'subscribe' : 'resubscribe'
    return { kind: 'noPlan', availableCents, hint: facts.isCloud ? hint : null }
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
    topUpInUse: planCents === 0 && topUpCents > 0
  }
}
