import { describe, expect, it } from 'vitest'

import { addCreditsEmphasis } from './creditsCard'
import type { AddCreditsEmphasisFacts } from './creditsCard'

const outOfCredits: AddCreditsEmphasisFacts = {
  availableCents: 0,
  canTopUp: true,
  autoTopUpStatus: 'off',
  planActionIsPrimary: false
}

describe('addCreditsEmphasis', () => {
  it.for([
    { case: 'at 0 with auto top-up off', facts: {}, variant: 'inverted' },
    {
      case: 'overdrawn',
      facts: { availableCents: -500 },
      variant: 'inverted'
    },
    {
      case: 'when auto top-up failed',
      facts: { autoTopUpStatus: 'failed' },
      variant: 'inverted'
    },
    {
      case: 'when auto top-up is at its budget limit',
      facts: { autoTopUpStatus: 'paused_by_budget' },
      variant: 'inverted'
    },
    {
      case: 'when auto top-up is on hold',
      facts: { autoTopUpStatus: 'on_hold' },
      variant: 'inverted'
    },
    {
      case: 'when the auto top-up status is not served',
      facts: { autoTopUpStatus: null },
      variant: 'inverted'
    },
    {
      case: 'with credits left',
      facts: { availableCents: 500 },
      variant: 'secondary'
    },
    {
      case: 'when the balance is unavailable',
      facts: { availableCents: null },
      variant: 'secondary'
    },
    {
      case: 'when auto top-up will refill',
      facts: { autoTopUpStatus: 'on' },
      variant: 'secondary'
    },
    {
      case: 'when the server withholds can_top_up',
      facts: { canTopUp: false },
      variant: 'secondary'
    },
    {
      case: 'while Subscribe is the white action',
      facts: { planActionIsPrimary: true },
      variant: 'secondary'
    }
  ] satisfies {
    case: string
    facts: Partial<AddCreditsEmphasisFacts>
    variant: 'inverted' | 'secondary'
  }[])('is $variant $case', ({ facts, variant }) => {
    expect(addCreditsEmphasis({ ...outOfCredits, ...facts })).toBe(variant)
  })
})
