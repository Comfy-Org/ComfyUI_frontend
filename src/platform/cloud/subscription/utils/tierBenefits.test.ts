import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCommonTierBenefits } from '@/platform/cloud/subscription/utils/tierBenefits'

const mockRemoteConfig = vi.hoisted(() => ({
  value: { free_tier_credits: 120 } as Record<string, unknown>
}))

vi.mock('@/platform/remoteConfig/remoteConfig', () => ({
  remoteConfig: mockRemoteConfig
}))

const translate = (key: string) => `t:${key}`
const formatNumber = (value: number) => `n:${value}`

describe('getCommonTierBenefits', () => {
  beforeEach(() => {
    mockRemoteConfig.value = { free_tier_credits: 120 }
  })

  it('includes monthlyCredits only for the free tier when credits are configured', () => {
    const freeBenefits = getCommonTierBenefits('free', translate, formatNumber)

    const monthlyCredits = freeBenefits.find((b) => b.key === 'monthlyCredits')
    expect(monthlyCredits).toEqual({
      key: 'monthlyCredits',
      type: 'metric',
      value: 'n:120',
      label: 't:subscription.monthlyCreditsLabel'
    })

    const paidBenefits = getCommonTierBenefits(
      'standard',
      translate,
      formatNumber
    )
    expect(paidBenefits.some((b) => b.key === 'monthlyCredits')).toBe(false)
  })

  it('omits monthlyCredits for free tier when remoteConfig has no credits', () => {
    mockRemoteConfig.value = {}

    const benefits = getCommonTierBenefits('free', translate, formatNumber)

    expect(benefits.some((b) => b.key === 'monthlyCredits')).toBe(false)
  })

  it('includes a tier-scoped maxDuration metric for every tier', () => {
    const tiers = ['free', 'standard', 'creator', 'pro', 'founder'] as const

    for (const tier of tiers) {
      const benefits = getCommonTierBenefits(tier, translate, formatNumber)
      const maxDuration = benefits.find((b) => b.key === 'maxDuration')

      expect(maxDuration).toEqual({
        key: 'maxDuration',
        type: 'metric',
        value: `t:subscription.maxDuration.${tier}`,
        label: 't:subscription.maxDurationLabel'
      })
    }
  })

  it('always includes the gpu feature benefit', () => {
    const benefits = getCommonTierBenefits('creator', translate, formatNumber)

    expect(benefits).toContainEqual({
      key: 'gpu',
      type: 'feature',
      label: 't:subscription.gpuLabel'
    })
  })

  it('adds the addCredits benefit for every tier except free', () => {
    const paidTiers = ['standard', 'creator', 'pro', 'founder'] as const

    for (const tier of paidTiers) {
      const benefits = getCommonTierBenefits(tier, translate, formatNumber)
      expect(benefits.some((b) => b.key === 'addCredits')).toBe(true)
    }

    const freeBenefits = getCommonTierBenefits('free', translate, formatNumber)
    expect(freeBenefits.some((b) => b.key === 'addCredits')).toBe(false)
  })

  it('includes customLoRAs only when the tier has it enabled', () => {
    const creator = getCommonTierBenefits('creator', translate, formatNumber)
    const pro = getCommonTierBenefits('pro', translate, formatNumber)
    expect(creator.some((b) => b.key === 'customLoRAs')).toBe(true)
    expect(pro.some((b) => b.key === 'customLoRAs')).toBe(true)

    const tiersWithoutLoRAs = ['free', 'standard', 'founder'] as const
    for (const tier of tiersWithoutLoRAs) {
      const benefits = getCommonTierBenefits(tier, translate, formatNumber)
      expect(benefits.some((b) => b.key === 'customLoRAs')).toBe(false)
    }
  })

  it('forwards translation params via the provided helpers', () => {
    const tSpy = vi.fn((key: string) => key)
    const nSpy = vi.fn((value: number) => String(value))

    getCommonTierBenefits('free', tSpy, nSpy)

    expect(nSpy).toHaveBeenCalledWith(120)
    expect(tSpy).toHaveBeenCalledWith('subscription.monthlyCreditsLabel')
    expect(tSpy).toHaveBeenCalledWith('subscription.maxDuration.free')
  })
})
