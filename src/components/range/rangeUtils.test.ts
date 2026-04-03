import { describe, expect, it } from 'vitest'

import {
  constrainRange,
  denormalize,
  formatMidpointLabel,
  gammaToPosition,
  isRangeValue,
  normalize,
  positionToGamma
} from './rangeUtils'

describe('normalize', () => {
  it('normalizes value to 0-1', () => {
    expect(normalize(128, 0, 256)).toBe(0.5)
    expect(normalize(0, 0, 255)).toBe(0)
    expect(normalize(255, 0, 255)).toBe(1)
  })

  it('returns 0 when min equals max', () => {
    expect(normalize(5, 5, 5)).toBe(0)
  })
})

describe('denormalize', () => {
  it('converts normalized value back to range', () => {
    expect(denormalize(0.5, 0, 256)).toBe(128)
    expect(denormalize(0, 0, 255)).toBe(0)
    expect(denormalize(1, 0, 255)).toBe(255)
  })

  it('round-trips with normalize', () => {
    expect(denormalize(normalize(100, 0, 255), 0, 255)).toBeCloseTo(100)
  })
})

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

describe('formatMidpointLabel', () => {
  it('formats linear scale as decimal', () => {
    expect(formatMidpointLabel(0.5, 'linear')).toBe('0.50')
  })

  it('formats gamma scale as gamma value', () => {
    expect(formatMidpointLabel(0.5, 'gamma')).toBe('1.00')
  })
})

describe('constrainRange', () => {
  it('passes through valid range unchanged', () => {
    const result = constrainRange({ min: 0.2, max: 0.8 })
    expect(result).toEqual({ min: 0.2, max: 0.8, midpoint: undefined })
  })

  it('clamps values to default [0, 1]', () => {
    const result = constrainRange({ min: -0.5, max: 1.5 })
    expect(result.min).toBe(0)
    expect(result.max).toBe(1)
  })

  it('clamps values to custom range', () => {
    const result = constrainRange({ min: -10, max: 300 }, 0, 255)
    expect(result.min).toBe(0)
    expect(result.max).toBe(255)
  })

  it('enforces min <= max', () => {
    const result = constrainRange({ min: 0.8, max: 0.3 })
    expect(result.min).toBe(0.8)
    expect(result.max).toBe(0.8)
  })

  it('preserves midpoint when present', () => {
    const result = constrainRange({ min: 0.2, max: 0.8, midpoint: 0.5 })
    expect(result.midpoint).toBe(0.5)
  })

  it('clamps midpoint to [0, 1]', () => {
    const result = constrainRange({ min: 0.2, max: 0.8, midpoint: 1.5 })
    expect(result.midpoint).toBe(1)
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
