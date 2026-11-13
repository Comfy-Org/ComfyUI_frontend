import { describe, expect, it } from 'vitest'

import { deriveCreditsFlyout } from './creditsFlyout'
import type { CreditsFlyoutFacts } from './creditsFlyout'

const active: CreditsFlyoutFacts = {
  loading: false,
  balance: {
    amountMicros: 3600,
    effectiveBalanceMicros: 3600,
    cloudCreditBalanceMicros: 2630,
    prepaidBalanceMicros: 970
  },
  planKind: 'active',
  billingStatus: 'paid',
  periodCreditGrant: { state: 'amount', credits: 7400, period: 'MONTHLY' },
  nextCreditRefillAt: '2026-10-28T00:00:00Z',
  endDate: null
}

const facts = (over: Partial<CreditsFlyoutFacts>) => ({ ...active, ...over })

describe('deriveCreditsFlyout', () => {
  it('shows the plan pool from period_credit_grant with its refill date', () => {
    expect(deriveCreditsFlyout(active)).toEqual({
      kind: 'plan',
      availableCents: 3600,
      planCents: 2630,
      planPoolCredits: 7400,
      topUpCents: 970,
      topUpInUse: false,
      showUsage: true,
      planDate: { kind: 'refills', date: '2026-10-28T00:00:00Z' },
      cadence: 'monthly'
    })
  })

  it('keeps the year for a yearly grant', () => {
    const state = deriveCreditsFlyout(
      facts({
        periodCreditGrant: { state: 'amount', credits: 88800, period: 'ANNUAL' }
      })
    )
    expect(state).toMatchObject({ kind: 'plan', cadence: 'yearly' })
  })

  it.for([
    { case: 'not served', grant: null },
    { case: 'unknown', grant: { state: 'unknown' as const } }
  ])('has no plan total when the grant is $case', ({ grant }) => {
    expect(
      deriveCreditsFlyout(facts({ periodCreditGrant: grant }))
    ).toMatchObject({ kind: 'plan', planPoolCredits: null, cadence: null })
  })

  it.for([
    { case: 'no plan', over: { planKind: 'noPlan' as const } },
    { case: 'an ended plan', over: { planKind: 'ended' as const } },
    {
      case: 'a proven zero grant',
      over: { periodCreditGrant: { state: 'none' as const } }
    }
  ])('shows top-up credits only for $case', ({ over }) => {
    expect(deriveCreditsFlyout(facts(over))).toEqual({
      kind: 'noPlan',
      topUpCents: 3600
    })
  })

  it('stops top-up at 0 with no plan and an overdrawn balance', () => {
    expect(
      deriveCreditsFlyout(
        facts({
          planKind: 'noPlan',
          balance: { amountMicros: -120, effectiveBalanceMicros: -120 }
        })
      )
    ).toEqual({ kind: 'noPlan', topUpCents: 0 })
  })

  it('stops both pools at 0 when overdrawn', () => {
    const state = deriveCreditsFlyout(
      facts({ balance: { ...active.balance!, effectiveBalanceMicros: -50 } })
    )
    expect(state).toMatchObject({ kind: 'plan', planCents: 0, topUpCents: 0 })
  })

  it('keeps the bar and refills after payment while paused', () => {
    expect(
      deriveCreditsFlyout(facts({ billingStatus: 'paused' }))
    ).toMatchObject({
      planCents: 0,
      showUsage: true,
      planDate: { kind: 'afterPayment' }
    })
  })

  it('shows the end date for an ending plan', () => {
    expect(
      deriveCreditsFlyout(
        facts({ planKind: 'ending', endDate: '2026-12-01T00:00:00Z' })
      )
    ).toMatchObject({
      planDate: { kind: 'availableUntil', date: '2026-12-01T00:00:00Z' }
    })
  })

  it('loads until the first balance arrives', () => {
    expect(
      deriveCreditsFlyout(facts({ loading: true, balance: null }))
    ).toEqual({ kind: 'loading' })
  })

  it('keeps the last balance while a refresh loads', () => {
    expect(deriveCreditsFlyout(facts({ loading: true }))).toMatchObject({
      kind: 'plan'
    })
  })

  it.for([
    { case: 'missing', balance: null },
    {
      case: 'not authoritative',
      balance: { amountMicros: 10, effectiveBalanceAuthoritative: false }
    }
  ])('is unavailable when the balance is $case', ({ balance }) => {
    expect(deriveCreditsFlyout(facts({ balance }))).toEqual({
      kind: 'unavailable'
    })
  })
})
