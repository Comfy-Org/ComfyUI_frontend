import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import type { EffectScope } from 'vue'

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

const mockApp = vi.hoisted((): { graph: { rootGraph: object } | null } => ({
  graph: null
}))
vi.mock('@/scripts/app', () => ({
  app: mockApp
}))

const mockGraphCreditsBadges = vi.hoisted(() =>
  vi.fn((): readonly object[] => [])
)
vi.mock('@/systems/badgeSystem', () => ({
  graphCreditsBadges: mockGraphCreditsBadges
}))

const mockRemoteConfig = vi.hoisted(() => ({
  value: { free_tier_balance: { allowance: 5, remaining: 5 } }
}))
vi.mock('@/platform/remoteConfig/remoteConfig', () => ({
  remoteConfig: mockRemoteConfig
}))

const { useFreeTierQuota } = await import('./useFreeTierQuota')

let scope: EffectScope | undefined

function loadQuota() {
  scope = effectScope()
  return scope.run(useFreeTierQuota)!
}

describe('useFreeTierQuota', () => {
  beforeEach(() => {
    mockIsCloud.value = true
    mockFlags.freeTierJobAllowanceEnabled = true
    mockApp.graph = null
    mockGraphCreditsBadges.mockReturnValue([])
    mockRemoteConfig.value = {
      free_tier_balance: { allowance: 5, remaining: 5 }
    }
  })

  afterEach(() => {
    scope?.stop()
    scope = undefined
  })

  it('enables the quota on Cloud when the flag and an allowance are present', () => {
    const quota = loadQuota()

    expect(quota.quotaEnabled.value).toBe(true)
    expect(quota.freeTierExecutionPermitted.value).toBe(true)
  })

  it('keeps the quota disabled off Cloud even when the flag and an allowance are present', () => {
    mockIsCloud.value = false

    const quota = loadQuota()

    expect(quota.quotaEnabled.value).toBe(false)
    expect(quota.freeTierExecutionPermitted.value).toBe(false)
  })

  it('disallows free-tier execution when the graph contains credit badges', () => {
    mockApp.graph = { rootGraph: {} }
    mockGraphCreditsBadges.mockReturnValue([{}])

    const quota = loadQuota()

    expect(quota.quotaEnabled.value).toBe(true)
    expect(quota.hasInvalidNodes.value).toBe(true)
    expect(quota.freeTierExecutionPermitted.value).toBe(false)
  })
})
