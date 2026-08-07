import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

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

async function loadQuota() {
  vi.resetModules()
  const { useFreeTierQuota } = await import('./useFreeTierQuota')
  return useFreeTierQuota()
}

describe('useFreeTierQuota', () => {
  beforeEach(() => {
    mockIsCloud.value = true
    mockFlags.freeTierJobAllowanceEnabled = true
    mockRemoteConfig.value = {
      free_tier_balance: { allowance: 5, remaining: 5 }
    }
  })

  it('enables the quota on Cloud when the flag and an allowance are present', async () => {
    const quota = await loadQuota()

    expect(quota.quotaEnabled.value).toBe(true)
  })

  it('keeps the quota disabled off Cloud even when the flag and an allowance are present', async () => {
    mockIsCloud.value = false

    const quota = await loadQuota()

    expect(quota.quotaEnabled.value).toBe(false)
    expect(quota.freeTierExecutionPermitted.value).toBe(false)
  })
})
