import { describe, expect, it, vi } from 'vitest'

import { useFreeTierQuota } from './useFreeTierQuota'

vi.mock('@vueuse/core', () => ({
  createSharedComposable: <T extends (...args: unknown[]) => unknown>(fn: T) =>
    fn
}))

const mockIsCloud = vi.hoisted(() => ({ value: true }))
vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: { freeTierJobAllowanceEnabled: true }
  })
}))

vi.mock('@/scripts/app', () => ({ app: {} }))
vi.mock('@/systems/badgeSystem', () => ({ graphCreditsBadges: () => [] }))

vi.mock('@/platform/remoteConfig/remoteConfig', () => ({
  remoteConfig: {
    value: { free_tier_balance: { allowance: 5, remaining: 5 } }
  }
}))

describe('useFreeTierQuota', () => {
  it('enables the quota on Cloud when the flag and an allowance are present', () => {
    mockIsCloud.value = true

    const quota = useFreeTierQuota()

    expect(quota.quotaEnabled.value).toBe(true)
    expect(quota.freeTierExecutionPermitted.value).toBe(true)
  })

  it('keeps the quota disabled off Cloud even when the flag and an allowance are present', () => {
    mockIsCloud.value = false

    const quota = useFreeTierQuota()

    expect(quota.quotaEnabled.value).toBe(false)
    expect(quota.freeTierExecutionPermitted.value).toBe(false)
  })
})
