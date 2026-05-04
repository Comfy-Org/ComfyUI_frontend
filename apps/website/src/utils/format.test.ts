import { describe, expect, it } from 'vitest'

import { formatMediumDate, formatNumber } from './format'

describe('formatNumber', () => {
  it('formats numbers using the given locale', () => {
    expect(formatNumber(2618646, 'en')).toBe('2,618,646')
    expect(formatNumber(2618646, 'de')).toBe('2.618.646')
  })

  it('returns an em-dash for undefined', () => {
    expect(formatNumber(undefined, 'en')).toBe('—')
  })

  it('returns an em-dash for NaN and Infinity', () => {
    expect(formatNumber(Number.NaN, 'en')).toBe('—')
    expect(formatNumber(Number.POSITIVE_INFINITY, 'en')).toBe('—')
  })

  it('formats zero as "0"', () => {
    expect(formatNumber(0, 'en')).toBe('0')
  })
})

describe('formatMediumDate', () => {
  it('formats an ISO date with the medium style', () => {
    expect(formatMediumDate('2026-04-19T00:00:00Z', 'en')).toMatch(
      /Apr \d{1,2}, 2026/
    )
  })

  it('returns an em-dash for undefined', () => {
    expect(formatMediumDate(undefined, 'en')).toBe('—')
  })

  it('returns an em-dash for unparseable strings', () => {
    expect(formatMediumDate('not a date', 'en')).toBe('—')
  })
})
