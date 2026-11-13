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
  // The plan total is only ever the served period_credit_grant.
  const card = deriveCreditsCard({ ...facts, planPoolCredits: null })
  if (card.kind === 'unavailable') return card
  // Pools stop at 0; the Credits row carries the signed total.
  if (card.kind === 'noPlan') {
    return { kind: 'noPlan', topUpCents: Math.max(card.availableCents, 0) }
  }
  return {
    ...card,
    // The flyout keeps the bar while paused (Figma Paused row).
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
