import { describe, expect, it, vi } from 'vitest'

import {
  formatRefillsDate,
  formatSubscriptionDate,
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

  it('formats as MM/DD/YY in local time', () => {
    // No `Z` suffix: the timestamp is parsed as local time and formatRefillsDate
    // reads local date parts, so midday avoids any cross-timezone day rollover.
    const result = formatRefillsDate('2026-06-15T12:00:00')
    expect(result).toBe('06/15/26')
  })
})

describe('getPlanTotalCreditsValue', () => {
  it('returns monthly credits unchanged for monthly plans', () => {
    expect(getPlanTotalCreditsValue('standard', false)).toBe(4200)
  })

  it('multiplies monthly credits by 12 for yearly plans', () => {
    const monthly = getPlanTotalCreditsValue('standard', false)!
    expect(getPlanTotalCreditsValue('standard', true)).toBe(monthly * 12)
  })
})
