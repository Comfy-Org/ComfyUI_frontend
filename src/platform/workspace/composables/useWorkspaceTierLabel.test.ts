import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useWorkspaceTierLabel } from './useWorkspaceTierLabel'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: vi.fn((key: string, params?: Record<string, unknown>) => {
      if (key === 'subscription.tierNameYearly') return `${params?.name} Yearly`

      const tierNames: Record<string, string> = {
        'subscription.tiers.free.name': 'Free',
        'subscription.tiers.standard.name': 'Standard',
        'subscription.tiers.creator.name': 'Creator',
        'subscription.tiers.pro.name': 'Pro',
        'subscription.tiers.founder.name': "Founder's Edition"
      }
      return tierNames[key] ?? key
    })
  })
}))

describe('useWorkspaceTierLabel', () => {
  let formatTierName: ReturnType<typeof useWorkspaceTierLabel>['formatTierName']
  let getTierLabel: ReturnType<typeof useWorkspaceTierLabel>['getTierLabel']

  beforeEach(() => {
    const composable = useWorkspaceTierLabel()
    formatTierName = composable.formatTierName
    getTierLabel = composable.getTierLabel
  })

  describe('formatTierName', () => {
    it('returns empty string for null tier', () => {
      expect(formatTierName(null, false)).toBe('')
    })

    it('returns empty string for undefined tier', () => {
      expect(formatTierName(undefined, false)).toBe('')
    })

    it('returns base name for monthly plan', () => {
      expect(formatTierName('PRO', false)).toBe('Pro')
    })

    it('appends yearly suffix for yearly plan', () => {
      expect(formatTierName('PRO', true)).toBe('Pro Yearly')
    })

    it('maps FOUNDERS_EDITION to founder label', () => {
      expect(formatTierName('FOUNDERS_EDITION', false)).toBe(
        "Founder's Edition"
      )
    })

    it('falls back to standard for unknown tier', () => {
      expect(formatTierName('UNKNOWN_TIER', false)).toBe('')
    })
  })

  describe('getTierLabel', () => {
    it('returns null when workspace is not subscribed', () => {
      const result = getTierLabel({
        isSubscribed: false,
        subscriptionPlan: 'PRO_MONTHLY',
        subscriptionTier: 'PRO'
      })
      expect(result).toBeNull()
    })

    it('uses subscriptionTier when available', () => {
      const result = getTierLabel({
        isSubscribed: true,
        subscriptionPlan: null,
        subscriptionTier: 'CREATOR'
      })
      expect(result).toBe('Creator')
    })

    it('ignores plan slug yearly when subscriptionTier is present', () => {
      const result = getTierLabel({
        isSubscribed: true,
        subscriptionPlan: 'PRO_YEARLY',
        subscriptionTier: 'PRO'
      })
      expect(result).toBe('Pro')
    })

    it('falls back to parsing subscriptionPlan when tier is null', () => {
      const result = getTierLabel({
        isSubscribed: true,
        subscriptionPlan: 'CREATOR_MONTHLY',
        subscriptionTier: null
      })
      expect(result).toBe('Creator')
    })

    it('returns null when subscribed but both tier and plan are null', () => {
      const result = getTierLabel({
        isSubscribed: true,
        subscriptionPlan: null,
        subscriptionTier: null
      })
      expect(result).toBeNull()
    })

    it('returns null when plan slug does not match any known tier', () => {
      const result = getTierLabel({
        isSubscribed: true,
        subscriptionPlan: 'ENTERPRISE_CUSTOM',
        subscriptionTier: null
      })
      expect(result).toBeNull()
    })

    it('handles FOUNDERS_EDITION tier', () => {
      const result = getTierLabel({
        isSubscribed: true,
        subscriptionPlan: null,
        subscriptionTier: 'FOUNDERS_EDITION'
      })
      expect(result).toBe("Founder's Edition")
    })

    it('parses yearly suffix from plan slug fallback', () => {
      const result = getTierLabel({
        isSubscribed: true,
        subscriptionPlan: 'STANDARD_YEARLY',
        subscriptionTier: null
      })
      expect(result).toBe('Standard Yearly')
    })

    it('parses FOUNDERS_EDITION from plan slug fallback', () => {
      const result = getTierLabel({
        isSubscribed: true,
        subscriptionPlan: 'FOUNDERS_EDITION_MONTHLY',
        subscriptionTier: null
      })
      expect(result).toBe("Founder's Edition")
    })
  })
})
