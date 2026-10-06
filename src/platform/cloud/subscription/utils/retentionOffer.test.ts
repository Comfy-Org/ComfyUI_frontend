import { describe, expect, it } from 'vitest'

import type { RetentionOfferEvent, RetentionOfferPhase } from './retentionOffer'
import {
  discountedAmount,
  fullPriceRenewal,
  outcomeOnClose,
  reduceRetentionOffer
} from './retentionOffer'

const phases: RetentionOfferPhase[] = [
  'offered',
  'accepting',
  'applied',
  'failed',
  'unconfirmed'
]

const transitions: Record<
  RetentionOfferEvent['type'],
  Partial<Record<RetentionOfferPhase, RetentionOfferPhase>>
> = {
  acceptRequested: {
    offered: 'accepting',
    failed: 'accepting',
    unconfirmed: 'accepting'
  },
  applied: { accepting: 'applied' },
  rejected: { accepting: 'failed' },
  unconfirmed: { accepting: 'unconfirmed' }
}

const events: RetentionOfferEvent[] = [
  { type: 'acceptRequested' },
  { type: 'applied' },
  { type: 'rejected' },
  { type: 'unconfirmed' }
]

const cases = phases.flatMap((phase) =>
  events.map((event) => ({
    phase,
    event,
    expected: transitions[event.type][phase] ?? phase
  }))
)

describe('reduceRetentionOffer', () => {
  it.for(cases)(
    '$event.type from $phase leads to $expected',
    ({ phase, event, expected }) => {
      expect(reduceRetentionOffer(phase, event)).toBe(expected)
    }
  )
})

describe('outcomeOnClose', () => {
  it.for([
    { phase: 'offered', outcome: 'dismissed' },
    { phase: 'failed', outcome: 'dismissed' },
    { phase: 'accepting', outcome: 'pending' },
    { phase: 'unconfirmed', outcome: 'pending' },
    { phase: 'applied', outcome: 'retained' }
  ] as const)('closing from $phase is $outcome', ({ phase, outcome }) => {
    expect(outcomeOnClose(phase)).toBe(outcome)
  })
})

describe('discountedAmount', () => {
  it.for([
    { amount: 2000, percent: 30, expected: 1400 },
    { amount: 999, percent: 30, expected: 699 },
    { amount: 2000, percent: 0, expected: 2000 }
  ])('$percent% off $amount is $expected', ({ amount, percent, expected }) => {
    expect(discountedAmount(amount, { percent_off: percent })).toBe(expected)
  })
})

describe('fullPriceRenewal', () => {
  it.for([
    {
      from: Date.UTC(2026, 10, 12, 8),
      months: 3,
      to: '2027-02-12T08:00:00.000Z'
    },
    {
      from: Date.UTC(2027, 0, 31, 8),
      months: 1,
      to: '2027-02-28T08:00:00.000Z'
    },
    {
      from: Date.UTC(2027, 11, 31, 8),
      months: 2,
      to: '2028-02-29T08:00:00.000Z'
    },
    {
      from: Date.UTC(2026, 7, 31, 8),
      months: 3,
      to: '2026-11-30T08:00:00.000Z'
    }
  ])('$months months after $from is $to', ({ from, months, to }) => {
    expect(fullPriceRenewal(from / 1000, months).toISOString()).toBe(to)
  })
})
