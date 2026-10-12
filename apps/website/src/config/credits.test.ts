import { describe, expect, it } from 'vitest'

import {
  MAX_TOP_UP_USD,
  MIN_TOP_UP_USD,
  clampTopUp,
  usdToCredits
} from './credits'

describe('credit top-up amounts', () => {
  it('converts dollars with the shared credit rate', () => {
    expect(usdToCredits(5)).toBe(1_055)
    expect(usdToCredits(25)).toBe(5_275)
  })

  it('clamps custom amounts to the hosted checkout contract', () => {
    expect(clampTopUp(0)).toBe(MIN_TOP_UP_USD)
    expect(clampTopUp(5_000)).toBe(MAX_TOP_UP_USD)
    expect(clampTopUp(Number.NaN)).toBe(MIN_TOP_UP_USD)
  })
})
