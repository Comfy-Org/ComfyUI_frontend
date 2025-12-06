import { describe, expect, test } from 'vitest'

import {
  COMFY_CREDIT_RATE_CENTS,
  COMFY_CREDIT_RATE_USD,
  centsToCredits,
  creditsToCents,
  creditsToUsd,
  formatCredits,
  formatCreditsFromCents,
  formatCreditsFromUsd,
  formatUsd,
  formatUsdFromCents,
  usdToCents,
  usdToCredits
} from '@/base/credits/comfyCredits'

describe('comfyCredits helpers', () => {
  test('exposes the fixed conversion rate', () => {
    expect(COMFY_CREDIT_RATE_CENTS).toBe(210)
    expect(COMFY_CREDIT_RATE_USD).toBeCloseTo(2.1)
  })

  test('converts between USD and cents', () => {
    expect(usdToCents(1.23)).toBe(123)
    expect(formatUsdFromCents({ cents: 123, locale: 'en-US' })).toBe('1.23')
  })

  test('converts cents to credits and back', () => {
    expect(centsToCredits(210)).toBeCloseTo(1)
    expect(creditsToCents(5)).toBe(1050)
  })

  test('converts USD to credits and back', () => {
    expect(usdToCredits(2.1)).toBeCloseTo(1)
    expect(creditsToUsd(3.5)).toBeCloseTo(7.35)
  })

  test('formats credits and USD values using en-US locale', () => {
    const locale = 'en-US'
    expect(formatCredits({ value: 1234.567, locale })).toBe('1,234.57')
    expect(formatCreditsFromCents({ cents: 210, locale })).toBe('1.00')
    expect(formatCreditsFromUsd({ usd: 4.2, locale })).toBe('2.00')
    expect(formatUsd({ value: 4.2, locale })).toBe('4.20')
  })
})
