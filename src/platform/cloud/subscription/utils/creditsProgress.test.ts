import { describe, expect, it } from 'vitest'

import { computeCreditsProgress } from '@/platform/cloud/subscription/utils/creditsProgress'

describe('computeCreditsProgress', () => {
  it('scales both segments to the monthly allowance', () => {
    const { monthlyFraction, additionalFraction } = computeCreditsProgress(
      105_450,
      42_000,
      200_000
    )
    expect(monthlyFraction).toBeCloseTo(0.5273, 4)
    expect(additionalFraction).toBeCloseTo(0.21, 4)
  })

  it('returns zeroed segments when the monthly allowance is unknown', () => {
    expect(computeCreditsProgress(100, 50, 0)).toEqual({
      monthlyFraction: 0,
      additionalFraction: 0
    })
  })

  it('clamps the monthly segment to a full bar when remaining exceeds allowance', () => {
    const { monthlyFraction, additionalFraction } = computeCreditsProgress(
      503_805,
      2_110,
      253_200
    )
    expect(monthlyFraction).toBe(1)
    expect(additionalFraction).toBe(0)
  })

  it('caps the additional segment so the two never overflow the track', () => {
    const { monthlyFraction, additionalFraction } = computeCreditsProgress(
      150_000,
      100_000,
      200_000
    )
    expect(monthlyFraction).toBe(0.75)
    expect(additionalFraction).toBe(0.25)
    expect(monthlyFraction + additionalFraction).toBeLessThanOrEqual(1)
  })
})
