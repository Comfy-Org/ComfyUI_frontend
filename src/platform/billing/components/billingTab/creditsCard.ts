import type { BalanceInfo } from '@/platform/billing/composables/types'
import type { AutoReloadSettings, BillingStatus } from '@comfyorg/billing-core'
import type { PlanRowState } from '@/platform/billing/components/billingTab/planRow'

export interface CreditsCardFacts {
  balance: BalanceInfo | null
  planKind: PlanRowState['kind']
  billingStatus: BillingStatus | null
  planPoolCredits: number | null
  renewalDate: string | null
  endDate: string | null
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
      showUsage: boolean
      planDate:
        | { kind: 'refills' | 'availableUntil'; date: string | null }
        | { kind: 'afterPayment' }
    }

export type PlanCreditsState = Extract<CreditsCardState, { kind: 'plan' }>

const PLAN_USAGE_SHOWN: Record<BillingStatus, boolean> = {
  awaiting_payment_method: true,
  pending_payment: true,
  paid: true,
  payment_failed: true,
  paused: false,
  inactive: true
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
    showUsage: facts.billingStatus
      ? PLAN_USAGE_SHOWN[facts.billingStatus]
      : true,
    planDate: planDateFor(facts)
  }
}

export interface AddCreditsEmphasisFacts {
  availableCents: number | null
  canTopUp: boolean
  autoTopUpStatus: AutoReloadSettings['status'] | null
  planActionIsPrimary: boolean
}

/** White when out of credits, auto top-up won't refill, and no plan action already takes white. */
export function addCreditsEmphasis(
  facts: AddCreditsEmphasisFacts
): 'secondary' | 'inverted' {
  const outOfCredits =
    facts.availableCents !== null && facts.availableCents <= 0
  return outOfCredits &&
    facts.canTopUp &&
    facts.autoTopUpStatus !== 'on' &&
    !facts.planActionIsPrimary
    ? 'inverted'
    : 'secondary'
}

function planDateFor(facts: CreditsCardFacts): PlanCreditsState['planDate'] {
  switch (facts.planKind) {
    case 'paused':
      return { kind: 'afterPayment' }
    case 'ending':
      return { kind: 'availableUntil', date: facts.endDate }
    default:
      return { kind: 'refills', date: facts.renewalDate }
  }
}
