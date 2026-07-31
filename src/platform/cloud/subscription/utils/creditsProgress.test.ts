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

  // The cents ledger cannot represent every plan allowance exactly, so an
  // untouched balance reconstructs a few credits above it (FE-1451).
  it.for([
    { plan: 'standard-monthly', reconstructed: 4_201, allowance: 4_200 },
    { plan: 'standard-annual', reconstructed: 50_402, allowance: 50_400 },
    { plan: 'creator-monthly', reconstructed: 7_402, allowance: 7_400 },
    { plan: 'creator-annual', reconstructed: 88_801, allowance: 88_800 },
    { plan: 'founder-monthly', reconstructed: 5_463, allowance: 5_460 }
  ])(
    'clamps a $plan balance reconstructed above its allowance',
    ({ reconstructed, allowance }, { expect }) => {
      expect(computeMonthlyUsage(reconstructed, allowance)).toEqual({
        used: 0,
        remaining: allowance,
        usedFraction: 0
      })
    }
  )

  it('leaves an allowance the cents ledger represents exactly untouched', () => {
    expect(computeMonthlyUsage(21_100, 21_100)).toEqual({
      used: 0,
      remaining: 21_100,
      usedFraction: 0
    })
  })
})
