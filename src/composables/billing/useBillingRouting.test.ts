import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { BillingRail } from '@/platform/workspace/api/workspaceApi'

import { useBillingRouting } from './useBillingRouting'

const {
  mockIsCloud,
  mockConsolidatedBillingEnabled,
  mockActiveWorkspace,
  mockActiveWorkspaceBillingRail
} = vi.hoisted(() => ({
  mockIsCloud: { value: true },
  mockConsolidatedBillingEnabled: { value: false },
  mockActiveWorkspace: {
    value: null as { id: string; type: 'personal' | 'team' } | null
  },
  mockActiveWorkspaceBillingRail: {
    value: null as BillingRail | null
  }
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: {
      get consolidatedBillingEnabled() {
        return mockConsolidatedBillingEnabled.value
      }
    }
  })
}))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    get activeWorkspace() {
      return mockActiveWorkspace.value
    },
    get activeWorkspaceBillingRail() {
      return mockActiveWorkspaceBillingRail.value
    }
  })
}))

const personal = { id: 'w-personal', type: 'personal' as const }
const team = { id: 'w-team', type: 'team' as const }

describe('useBillingRouting', () => {
  beforeEach(() => {
    mockIsCloud.value = true
    mockConsolidatedBillingEnabled.value = false
    mockActiveWorkspace.value = personal
    mockActiveWorkspaceBillingRail.value = null
  })

  it('uses legacy billing off Cloud', () => {
    mockIsCloud.value = false
    mockActiveWorkspace.value = team

    const { type, shouldUseWorkspaceBilling } = useBillingRouting()

    expect(type.value).toBe('legacy')
    expect(shouldUseWorkspaceBilling.value).toBe(false)
  })

  it('keeps a Cloud personal workspace on legacy while consolidation is off', () => {
    mockActiveWorkspace.value = personal

    const { type, shouldUseWorkspaceBilling } = useBillingRouting()

    expect(type.value).toBe('legacy')
    expect(shouldUseWorkspaceBilling.value).toBe(false)
  })

  it('uses workspace billing for a Cloud personal workspace when consolidation is on', () => {
    mockConsolidatedBillingEnabled.value = true

    const { type, shouldUseWorkspaceBilling } = useBillingRouting()

    expect(type.value).toBe('workspace')
    expect(shouldUseWorkspaceBilling.value).toBe(true)
  })

  it('uses unified pricing while keeping legacy Stripe top-ups on Checkout', () => {
    mockConsolidatedBillingEnabled.value = true
    mockActiveWorkspace.value = personal
    mockActiveWorkspaceBillingRail.value = 'legacy_stripe'

    const { type, shouldUseWorkspaceBilling, shouldUseUnifiedPricing } =
      useBillingRouting()

    expect(type.value).toBe('legacy')
    expect(shouldUseWorkspaceBilling.value).toBe(false)
    expect(shouldUseUnifiedPricing.value).toBe(true)
  })

  it('uses workspace billing for migrated Stripe personal workspaces', () => {
    mockConsolidatedBillingEnabled.value = true
    mockActiveWorkspace.value = personal
    mockActiveWorkspaceBillingRail.value = 'stripe'

    const { type, shouldUseWorkspaceBilling } = useBillingRouting()

    expect(type.value).toBe('workspace')
    expect(shouldUseWorkspaceBilling.value).toBe(true)
  })

  it('uses workspace billing for team workspaces', () => {
    mockActiveWorkspace.value = team
    mockActiveWorkspaceBillingRail.value = 'legacy_stripe'

    const { type, shouldUseWorkspaceBilling } = useBillingRouting()

    expect(type.value).toBe('workspace')
    expect(shouldUseWorkspaceBilling.value).toBe(true)
  })

  it('defaults to legacy while the workspace has not loaded', () => {
    mockActiveWorkspace.value = null

    const { type } = useBillingRouting()

    expect(type.value).toBe('legacy')
  })
})
