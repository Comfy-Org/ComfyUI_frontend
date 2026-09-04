import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import type { EffectScope } from 'vue'

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

const mockCreditBadges = vi.hoisted<{ value: object[] }>(() => ({ value: [] }))
vi.mock('@/scripts/app', () => ({
  app: { isGraphReady: true, rootGraph: {} }
}))
vi.mock('@/systems/badgeSystem', () => ({
  graphCreditsBadges: () => mockCreditBadges.value
}))

const mockRemoteConfig = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  return ref({ free_tier_balance: { allowance: 5, remaining: 5 } })
})
vi.mock('@/platform/remoteConfig/remoteConfig', () => ({
  remoteConfig: mockRemoteConfig
}))

describe('useFreeTierQuota', () => {
  let scope: EffectScope

  function createQuota() {
    const quota = scope.run(() => useFreeTierQuota())
    if (!quota) throw new Error('Failed to create free tier quota')
    return quota
  }

  beforeEach(() => {
    scope = effectScope()
    mockIsCloud.value = true
    mockCreditBadges.value = []
    mockRemoteConfig.value = {
      free_tier_balance: { allowance: 5, remaining: 5 }
    }
  })

  afterEach(() => {
    scope.stop()
  })

  it('enables the quota on Cloud when the flag and an allowance are present', () => {
    const quota = createQuota()

    expect(quota.quotaEnabled.value).toBe(true)
    expect(quota.freeTierExecutionPermitted.value).toBe(true)
  })

  it('keeps the quota disabled off Cloud even when the flag and an allowance are present', () => {
    mockIsCloud.value = false

    const quota = createQuota()

    expect(quota.quotaEnabled.value).toBe(false)
    expect(quota.freeTierExecutionPermitted.value).toBe(false)
  })

  it('blocks free-tier execution when the graph has credit badges', () => {
    mockCreditBadges.value = [{}]

    const quota = createQuota()

    expect(quota.quotaEnabled.value).toBe(true)
    expect(quota.freeTierExecutionPermitted.value).toBe(false)
  })

  it('updates the quota when remote config changes', async () => {
    const quota = createQuota()

    mockRemoteConfig.value = {
      free_tier_balance: { allowance: 10, remaining: 3 }
    }
    await nextTick()

    expect(quota.available.value).toBe(3)
    expect(quota.maxAvailable.value).toBe(10)
  })
})
