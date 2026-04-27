import { describe, expect, it, vi } from 'vitest'

import {
  formatRefillsDate,
  formatSubscriptionDate,
  getNextMonthInvoice,
  getPlanTotalCreditsValue,
  getSubscriptionTierKey
} from './subscriptionPanelWorkspace.logic'

vi.mock('@/platform/remoteConfig/remoteConfig', () => ({
  remoteConfig: { value: { free_tier_credits: 100 } }
}))

describe('getSubscriptionTierKey', () => {
  it('returns default key for null tier', () => {
    expect(getSubscriptionTierKey(null)).toBe('standard')
  })

  it('returns default key for undefined tier', () => {
    expect(getSubscriptionTierKey(undefined)).toBe('standard')
  })

  it('maps known tiers correctly', () => {
    expect(getSubscriptionTierKey('STANDARD')).toBe('standard')
    expect(getSubscriptionTierKey('CREATOR')).toBe('creator')
    expect(getSubscriptionTierKey('PRO')).toBe('pro')
    expect(getSubscriptionTierKey('FREE')).toBe('free')
    expect(getSubscriptionTierKey('FOUNDERS_EDITION')).toBe('founder')
  })
})

describe('formatSubscriptionDate', () => {
  it('returns empty string for null', () => {
    expect(formatSubscriptionDate(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(formatSubscriptionDate(undefined)).toBe('')
  })

  it('formats a date string', () => {
    const result = formatSubscriptionDate('2026-06-15T12:00:00Z')
    expect(result).toContain('Jun')
    expect(result).toContain('2026')
  })
})

describe('formatRefillsDate', () => {
  it('returns empty string for null', () => {
    expect(formatRefillsDate(null)).toBe('')
  })

  it('formats as MM/DD/YY', () => {
    const result = formatRefillsDate('2026-06-15T12:00:00Z')
    expect(result).toBe('06/15/26')
  })
})

describe('getNextMonthInvoice', () => {
  it('multiplies member count by tier price', () => {
    expect(getNextMonthInvoice(3, 20)).toBe(60)
  })

  it('returns 0 for zero members', () => {
    expect(getNextMonthInvoice(0, 20)).toBe(0)
  })
})

describe('getPlanTotalCreditsValue', () => {
  it('returns monthly credits for standard tier', () => {
    expect(getPlanTotalCreditsValue('standard', false)).toBe(4200)
  })

  it('returns yearly credits (12x) for standard tier', () => {
    expect(getPlanTotalCreditsValue('standard', true)).toBe(50400)
  })

  it('returns creator tier credits', () => {
    expect(getPlanTotalCreditsValue('creator', false)).toBe(7400)
  })

  it('returns pro tier credits', () => {
    expect(getPlanTotalCreditsValue('pro', false)).toBe(21100)
  })
})
