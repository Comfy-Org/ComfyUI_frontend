import { describe, expect, it } from 'vitest'

import { clampPercentInt, formatPercent0 } from '@/utils/numberUtil'

describe('clampPercentInt', () => {
  it('rounds to nearest integer', () => {
    expect(clampPercentInt(42.7)).toBe(43)
    expect(clampPercentInt(42.3)).toBe(42)
  })

  it('clamps to 0 when negative', () => {
    expect(clampPercentInt(-5)).toBe(0)
  })

  it('clamps to 100 when over 100', () => {
    expect(clampPercentInt(150)).toBe(100)
  })

  it('defaults to 0 when undefined', () => {
    expect(clampPercentInt(undefined)).toBe(0)
  })

  it('passes through values in range', () => {
    expect(clampPercentInt(0)).toBe(0)
    expect(clampPercentInt(50)).toBe(50)
    expect(clampPercentInt(100)).toBe(100)
  })
})

describe('formatPercent0', () => {
  it('formats integer percent for en-US', () => {
    const result = formatPercent0('en-US', 42)
    expect(result).toBe('42%')
  })

  it('formats 0% correctly', () => {
    const result = formatPercent0('en-US', 0)
    expect(result).toBe('0%')
  })

  it('formats 100% correctly', () => {
    const result = formatPercent0('en-US', 100)
    expect(result).toBe('100%')
  })

  it('clamps and rounds before formatting', () => {
    expect(formatPercent0('en-US', 150)).toBe('100%')
    expect(formatPercent0('en-US', -10)).toBe('0%')
    expect(formatPercent0('en-US', 42.7)).toBe('43%')
  })
})
