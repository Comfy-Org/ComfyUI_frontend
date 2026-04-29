import { describe, expect, it } from 'vitest'

import { clampPercentInt, formatPercent0 } from './numberUtil'

describe('clampPercentInt', () => {
  it('clamps undefined to 0', () => {
    expect(clampPercentInt()).toBe(0)
    expect(clampPercentInt(undefined)).toBe(0)
  })

  it('rounds to nearest integer', () => {
    expect(clampPercentInt(42.3)).toBe(42)
    expect(clampPercentInt(42.7)).toBe(43)
    expect(clampPercentInt(0.5)).toBe(1)
  })

  it('clamps below 0 to 0', () => {
    expect(clampPercentInt(-10)).toBe(0)
    expect(clampPercentInt(-0.1)).toBe(0)
  })

  it('clamps above 100 to 100', () => {
    expect(clampPercentInt(150)).toBe(100)
    expect(clampPercentInt(100.4)).toBe(100)
  })

  it('returns boundary values as-is', () => {
    expect(clampPercentInt(0)).toBe(0)
    expect(clampPercentInt(100)).toBe(100)
  })
})

describe('formatPercent0', () => {
  it('formats a percentage in en-US locale', () => {
    expect(formatPercent0('en-US', 42)).toBe('42%')
  })

  it('formats 0%', () => {
    expect(formatPercent0('en-US', 0)).toBe('0%')
  })

  it('formats 100%', () => {
    expect(formatPercent0('en-US', 100)).toBe('100%')
  })

  it('rounds fractional values before formatting', () => {
    expect(formatPercent0('en-US', 42.7)).toBe('43%')
    expect(formatPercent0('en-US', 42.3)).toBe('42%')
  })

  it('clamps out-of-range values', () => {
    expect(formatPercent0('en-US', 150)).toBe('100%')
    expect(formatPercent0('en-US', -10)).toBe('0%')
  })
})
