import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/platform/remoteConfig/remoteConfig', () => ({
  remoteConfig: ref({ free_tier_credits: 500 })
}))

import {
  DEFAULT_TIER_KEY,
  getTierCredits,
  getTierFeatures,
  getTierPrice,
  KEY_TO_TIER,
  TIER_PRICING,
  TIER_TO_KEY
} from '@/platform/cloud/subscription/constants/tierPricing'
import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'

describe('tierPricing', () => {
  describe('TIER_TO_KEY / KEY_TO_TIER', () => {
    it('maps every tier to a key and back', () => {
      for (const [tier, key] of Object.entries(TIER_TO_KEY)) {
        expect(KEY_TO_TIER[key as TierKey]).toBe(tier)
      }
    })
  })

  describe('DEFAULT_TIER_KEY', () => {
    it('is standard', () => {
      expect(DEFAULT_TIER_KEY).toBe('standard')
    })
  })

  describe('getTierPrice', () => {
    it('returns 0 for free tier', () => {
      expect(getTierPrice('free')).toBe(0)
    })

    it('returns founder price regardless of yearly flag', () => {
      expect(getTierPrice('founder')).toBe(20)
      expect(getTierPrice('founder', true)).toBe(20)
    })

    it('returns monthly price by default', () => {
      expect(getTierPrice('standard')).toBe(TIER_PRICING.standard.monthly)
      expect(getTierPrice('pro')).toBe(TIER_PRICING.pro.monthly)
    })

    it('returns yearly price when requested', () => {
      expect(getTierPrice('creator', true)).toBe(TIER_PRICING.creator.yearly)
    })
  })

  describe('getTierCredits', () => {
    it('returns remote config value for free tier', () => {
      expect(getTierCredits('free')).toBe(500)
    })

    it('returns founder credits', () => {
      expect(getTierCredits('founder')).toBe(5460)
    })

    it('returns pricing credits for paid tiers', () => {
      expect(getTierCredits('standard')).toBe(TIER_PRICING.standard.credits)
      expect(getTierCredits('pro')).toBe(TIER_PRICING.pro.credits)
    })
  })

  describe('getTierFeatures', () => {
    it('returns features for each tier', () => {
      expect(getTierFeatures('free').customLoRAs).toBe(false)
      expect(getTierFeatures('creator').customLoRAs).toBe(true)
      expect(getTierFeatures('pro').maxMembers).toBe(20)
    })
  })
})
