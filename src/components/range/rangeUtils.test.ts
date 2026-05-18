import { describe, expect, it } from 'vitest'

import { gammaToPosition, isRangeValue, positionToGamma } from './rangeUtils'

describe('positionToGamma', () => {
  it('converts 0.5 to gamma 1.0', () => {
    expect(positionToGamma(0.5)).toBeCloseTo(1.0)
  })

  it('converts 0.25 to gamma 2.0', () => {
    expect(positionToGamma(0.25)).toBeCloseTo(2.0)
  })
})

describe('gammaToPosition', () => {
  it('converts gamma 1.0 to position 0.5', () => {
    expect(gammaToPosition(1.0)).toBeCloseTo(0.5)
  })

  it('converts gamma 2.0 to position 0.25', () => {
    expect(gammaToPosition(2.0)).toBeCloseTo(0.25)
  })

  it('round-trips with positionToGamma', () => {
    for (const pos of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      expect(gammaToPosition(positionToGamma(pos))).toBeCloseTo(pos)
    }
  })
})

describe('isRangeValue', () => {
  it('returns true for valid range', () => {
    expect(isRangeValue({ min: 0, max: 1 })).toBe(true)
    expect(isRangeValue({ min: 0, max: 1, midpoint: 0.5 })).toBe(true)
  })

  it('returns false for non-objects', () => {
    expect(isRangeValue(null)).toBe(false)
    expect(isRangeValue(42)).toBe(false)
    expect(isRangeValue('foo')).toBe(false)
    expect(isRangeValue([0, 1])).toBe(false)
  })

  it('returns false for objects missing min or max', () => {
    expect(isRangeValue({ min: 0 })).toBe(false)
    expect(isRangeValue({ max: 1 })).toBe(false)
    expect(isRangeValue({ min: 'a', max: 1 })).toBe(false)
  })
})
