import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type * as VueUseCoreModule from '@vueuse/core'

type VueUseCore = typeof VueUseCoreModule

vi.mock('@vueuse/core', async (importOriginal) => ({
  ...(await importOriginal<VueUseCore>()),
  createSharedComposable: <T extends (...args: unknown[]) => unknown>(fn: T) =>
    fn
}))

const mockIsCloud = vi.hoisted(() => ({ value: true }))
vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

const mockFlags = vi.hoisted(() => ({ freeTierJobAllowanceEnabled: true }))
vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({ flags: mockFlags })
}))

vi.mock('@/composables/node/usePriceBadge', () => ({
  useCreditsBadgesInGraph: () => ref([])
}))

const mockRemoteConfig = vi.hoisted(() => ({
  value: { free_tier_balance: { allowance: 5, remaining: 5 } }
}))
vi.mock('@/platform/remoteConfig/remoteConfig', () => ({
  get remoteConfig() {
    return ref(mockRemoteConfig.value)
  }
}))

const { useFreeTierQuota } = await import('./useFreeTierQuota')

describe('useFreeTierQuota', () => {
  beforeEach(() => {
    mockIsCloud.value = true
    mockFlags.freeTierJobAllowanceEnabled = true
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
})
