import { deriveCreditsCard } from './creditsCard'
import type { CreditsCardFacts, PlanCreditsState } from './creditsCard'

export interface CreditsFlyoutFacts extends Omit<
  CreditsCardFacts,
  'planPoolCredits'
> {
  loading: boolean
}

export type CreditsFlyoutPlan = PlanCreditsState & {
  cadence: 'monthly' | 'yearly' | null
}

export type CreditsFlyoutState =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'noPlan'; topUpCents: number }
  | CreditsFlyoutPlan

/** Maps the served balance and plan state onto the credits flyout breakdown. */
export function deriveCreditsFlyout(
  facts: CreditsFlyoutFacts
): CreditsFlyoutState {
  if (facts.loading && !facts.balance) return { kind: 'loading' }
  const card = deriveCreditsCard({ ...facts, planPoolCredits: null })
  if (card.kind === 'unavailable') return card
  if (card.kind === 'noPlan') {
    const overdrawn = card.availableCents < 0
    const prepaid = facts.balance?.prepaidBalanceMicros ?? 0
    return { kind: 'noPlan', topUpCents: overdrawn ? 0 : prepaid }
  }
  return {
    ...card,
    showUsage: true,
    cadence: cadenceOf(facts.periodCreditGrant?.period)
  }
}

function cadenceOf(
  period: NonNullable<CreditsCardFacts['periodCreditGrant']>['period']
): CreditsFlyoutPlan['cadence'] {
  if (period === 'MONTHLY') return 'monthly'
  if (period === 'ANNUAL') return 'yearly'
  return null
}
