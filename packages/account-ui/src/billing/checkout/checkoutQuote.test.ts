import { describe, expect, it } from 'vitest'

import { exactPreview, legacyPreview, plan } from './__fixtures__/preview'
import {
  amountDueTodayChanged,
  formatAmountDueToday,
  formatNumber,
  formatRenewalAmount,
  formatUsdFromCents,
  isYearlyCheckout,
  resolveRenewalDate
} from './checkoutQuote'

describe('formatAmountDueToday', () => {
  it.for([
    ['the exact quote when the server sent one', exactPreview(), '$15.00'],
    [
      'the legacy cost when the exact quote is absent',
      legacyPreview(),
      '$20.00'
    ],
    ['a non-USD exact quote', exactPreview({ currency: 'eur' }), '€15.00'],
    [
      'nothing for an exact quote without a currency',
      exactPreview({ currency: undefined }),
      ''
    ]
  ] as const)('prices %s', ([, preview, expected]) => {
    expect(formatAmountDueToday(preview, 'en')).toBe(expected)
  })
})

describe('amountDueTodayChanged', () => {
  it.for([
    [
      'a change when the exact amount moves behind an unchanged legacy cost',
      exactPreview({ amount_due_cents: 1600 }),
      exactPreview({ amount_due_cents: 2400 }),
      true
    ],
    [
      'a change when the currency moves at the same amount',
      exactPreview({ currency: 'usd' }),
      exactPreview({ currency: 'eur' }),
      true
    ],
    [
      'no change when a legacy quote is replaced by an exact quote of the same value',
      legacyPreview({ cost_today_cents: 1600 }),
      exactPreview({ amount_due_cents: 1600, currency: 'usd' }),
      false
    ],
    [
      'no change when only the legacy cost behind an exact quote moves',
      exactPreview({ cost_today_cents: 1600 }),
      exactPreview({ cost_today_cents: 2400 }),
      false
    ]
  ] as const)('reports %s', ([, installed, refreshed, expected]) => {
    expect(amountDueTodayChanged(installed, refreshed)).toBe(expected)
  })
})

describe('formatRenewalAmount', () => {
  it.for([
    ['the exact renewal when the server sent one', exactPreview(), '$25.00'],
    ['the legacy next-period cost', legacyPreview(), '$30.00']
  ] as const)('prices %s', ([, preview, expected]) => {
    expect(formatRenewalAmount(preview, 'en')).toBe(expected)
  })
})

describe('resolveRenewalDate', () => {
  it.for([
    ['the exact renewal instant', exactPreview(), '2026-07-19T00:00:00Z'],
    [
      'the target plan period end',
      legacyPreview({
        new_plan: plan('CREATOR', 'MONTHLY', 2000, '2026-08-19T00:00:00Z')
      }),
      '2026-08-19T00:00:00Z'
    ],
    ['no date when the server supplied none', legacyPreview(), undefined]
  ] as const)('resolves %s', ([, preview, expected]) => {
    expect(resolveRenewalDate(preview)).toBe(expected)
  })
})

describe('isYearlyCheckout', () => {
  it.for([
    ['an annual preview over a monthly cycle', 'ANNUAL', 'monthly', true],
    ['a monthly preview over a yearly cycle', 'MONTHLY', 'yearly', false],
    ['the yearly cycle when no preview resolved', undefined, 'yearly', true],
    ['the monthly cycle when no preview resolved', undefined, 'monthly', false]
  ] as const)('follows %s', ([, duration, cycle, expected]) => {
    expect(isYearlyCheckout(duration, cycle)).toBe(expected)
  })
})

describe('money display', () => {
  it.for([
    [5454, '54.54'],
    [33_600, '336.00'],
    [1_260_000, '12,600.00']
  ] as const)('keeps the cents of %i', ([cents, expected]) => {
    expect(formatUsdFromCents(cents, 'en')).toBe(expected)
  })

  it.for([
    [28, '28'],
    [1295, '1,295'],
    [27.5, '27.5']
  ] as const)('groups %d the way i18n n() does', ([usd, expected]) => {
    expect(formatNumber(usd, 'en')).toBe(expected)
  })
})
