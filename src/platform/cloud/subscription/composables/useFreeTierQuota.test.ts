import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

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

const mockRemoteConfig = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  return ref({ free_tier_balance: { allowance: 5, remaining: 5 } })
})
vi.mock('@/platform/remoteConfig/remoteConfig', () => ({
  remoteConfig: mockRemoteConfig
}))

describe('useFreeTierQuota', () => {
  beforeEach(() => {
    mockIsCloud.value = true
    mockRemoteConfig.value = {
      free_tier_balance: { allowance: 5, remaining: 5 }
    }
  })

  it('enables the quota on Cloud when the flag and an allowance are present', () => {
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

  it('updates the quota when remote config changes', async () => {
    const quota = useFreeTierQuota()

    mockRemoteConfig.value = {
      free_tier_balance: { allowance: 10, remaining: 3 }
    }
    await nextTick()

    expect(quota.available.value).toBe(3)
    expect(quota.maxAvailable.value).toBe(10)
  })
})
