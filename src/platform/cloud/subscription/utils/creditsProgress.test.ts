import { describe, expect, it } from 'vitest'

import { computeMonthlyUsage } from '@/platform/cloud/subscription/utils/creditsProgress'

describe('computeMonthlyUsage', () => {
  it('reports the consumed portion of the monthly allowance', () => {
    expect(computeMonthlyUsage(105_450, 200_000)).toEqual({
      used: 94_550,
      remaining: 105_450,
      usedFraction: 0.47275
    })
  })

  it('returns zero usage when the monthly allowance is unknown', () => {
    expect(computeMonthlyUsage(100, 0)).toEqual({
      used: 0,
      remaining: 0,
      usedFraction: 0
    })
  })

  it('treats a balance above the allowance (rollover) as nothing used', () => {
    expect(computeMonthlyUsage(503_805, 253_200)).toEqual({
      used: 0,
      remaining: 253_200,
      usedFraction: 0
    })
  })

  it('caps the fill at a full bar once the allowance is exhausted', () => {
    expect(computeMonthlyUsage(0, 200_000)).toEqual({
      used: 200_000,
      remaining: 0,
      usedFraction: 1
    })
  })

  it('caps used at the allowance when the remaining balance is negative', () => {
    expect(computeMonthlyUsage(-50_000, 200_000)).toEqual({
      used: 200_000,
      remaining: 0,
      usedFraction: 1
    })
  })

  // Standard grants 4,200 credits but the cents ledger can only hold 1,991c,
  // which reconstructs to 4,201 — one above the allowance.
  it('clamps a balance reconstructed just above the allowance', () => {
    expect(computeMonthlyUsage(4_201, 4_200)).toEqual({
      used: 0,
      remaining: 4_200,
      usedFraction: 0
    })
  })

  it('reports a full allowance when the balance matches it exactly', () => {
    expect(computeMonthlyUsage(21_100, 21_100)).toEqual({
      used: 0,
      remaining: 21_100,
      usedFraction: 0
    })
  })
})
