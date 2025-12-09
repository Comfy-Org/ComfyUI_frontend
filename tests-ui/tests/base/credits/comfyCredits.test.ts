import { describe, expect, test } from 'vitest'

import {
  CREDITS_PER_USD,
  COMFY_CREDIT_RATE_CENTS,
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
    expect(CREDITS_PER_USD).toBe(210)
    expect(COMFY_CREDIT_RATE_CENTS).toBeCloseTo(2.1) // credits per cent
  })

  test('converts between USD and cents', () => {
    expect(usdToCents(1.23)).toBe(123)
    expect(formatUsdFromCents({ cents: 123, locale: 'en-US' })).toBe('1.23')
  })

  test('converts cents to credits and back', () => {
    expect(centsToCredits(100)).toBe(210) // 100 cents = 210 credits
    expect(creditsToCents(210)).toBe(100) // 210 credits = 100 cents
  })

  test('converts USD to credits and back', () => {
    expect(usdToCredits(1)).toBe(210) // 1 USD = 210 credits
    expect(creditsToUsd(210)).toBe(1) // 210 credits = 1 USD
  })

  test('formats credits and USD values using en-US locale', () => {
    const locale = 'en-US'
    expect(formatCredits({ value: 1234.567, locale })).toBe('1,234.57')
    expect(formatCreditsFromCents({ cents: 100, locale })).toBe('210.00')
    expect(formatCreditsFromUsd({ usd: 1, locale })).toBe('210.00')
    expect(formatUsd({ value: 4.2, locale })).toBe('4.20')
  })
})
