import { describe, expect, test, vi } from 'vitest'

import {
  CREDITS_PER_USD,
  COMFY_CREDIT_RATE_CENTS,
  centsToCredits,
  clampUsd,
  creditsToCents,
  creditsToUsd,
  formatCredits,
  formatCreditsCompact,
  formatCreditsFromCents,
  formatCreditsFromUsd,
  formatUsd,
  formatUsdFromCents,
  usdToCents,
  usdToCredits
} from './creditsUtil'

describe('comfyCredits helpers', () => {
  test('exposes the fixed conversion rate', () => {
    expect(CREDITS_PER_USD).toBe(211)
    expect(COMFY_CREDIT_RATE_CENTS).toBeCloseTo(2.11) // credits per cent
  })

  test('converts between USD and cents', () => {
    expect(usdToCents(1.23)).toBe(123)
    expect(formatUsdFromCents({ cents: 123, locale: 'en-US' })).toBe('1.23')
  })

  test('converts cents to credits and back', () => {
    expect(centsToCredits(100)).toBe(211) // 100 cents = 211 credits
    expect(creditsToCents(211)).toBe(100) // 211 credits = 100 cents
  })

  test.for([
    [950, 2005],
    [1850, 3904],
    [3750, 7913],
    [7350, 15509],
    [14650, 30912]
  ] as const)(
    'rounds the exact half-credit tie at %s cents up to %s credits',
    ([cents, expected]) => {
      expect(centsToCredits(cents)).toBe(expected)
    }
  )

  test('converts USD to credits and back', () => {
    expect(usdToCredits(1)).toBe(211) // 1 USD = 211 credits
    expect(creditsToUsd(211)).toBe(1) // 211 credits = 1 USD
  })

  test('formats credits and USD values using en-US locale', () => {
    const locale = 'en-US'
    expect(formatCredits({ value: 1234.567, locale })).toBe('1,234.57')
    expect(formatCreditsFromCents({ cents: 100, locale })).toBe('211.00')
    expect(formatCreditsFromUsd({ usd: 1, locale })).toBe('211.00')
    expect(formatUsd({ value: 4.2, locale })).toBe('4.20')
  })

  test('clamps minimumFractionDigits when maximumFractionDigits is lower than default', () => {
    expect(
      formatCredits({
        value: 1.5,
        locale: 'en-US',
        numberOptions: { maximumFractionDigits: 0 }
      })
    ).toBe('2')

    expect(
      formatUsd({
        value: 3.456,
        locale: 'en-US',
        numberOptions: { maximumFractionDigits: 1 }
      })
    ).toBe('3.5')
  })

  test('clampUsd clamps values to the allowed purchase range', () => {
    expect(clampUsd(50)).toBe(50)
    expect(clampUsd(0.5)).toBe(1)
    expect(clampUsd(2000)).toBe(1000)
    expect(clampUsd(NaN)).toBe(0)
  })

  test('formatCreditsCompact abbreviates with the unit the magnitude calls for', () => {
    expect(formatCreditsCompact(42_200)).toBe('42.2K')
    expect(formatCreditsCompact(506_400)).toBe('506.4K')
    expect(formatCreditsCompact(1_012_800)).toBe('1M')
    expect(formatCreditsCompact(6_330_000)).toBe('6.3M')
  })

  test('formatCreditsCompact truncates, so it never overstates the amount', () => {
    expect(formatCreditsCompact(1_772_400)).toBe('1.7M')
    expect(formatCreditsCompact(10_550)).toBe('10.5K')
  })

  test('formatCreditsCompact leaves amounts below a thousand unabbreviated', () => {
    expect(formatCreditsCompact(0)).toBe('0')
    expect(formatCreditsCompact(999)).toBe('999')
  })

  test('formatCreditsCompact does not depend on Intl honouring roundingMode', () => {
    const NativeNumberFormat = Intl.NumberFormat
    vi.spyOn(Intl, 'NumberFormat').mockImplementation(function (
      locales?: Intl.LocalesArgument,
      options?: Intl.NumberFormatOptions
    ) {
      const { roundingMode: _unsupported, ...preV3 } = options ?? {}
      return new NativeNumberFormat(locales, preV3)
    })

    expect(formatCreditsCompact(1_772_400)).toBe('1.7M')
    expect(formatCreditsCompact(2_899_999)).toBe('2.8M')
    expect(formatCreditsCompact(31_650)).toBe('31.6K')
  })
})
