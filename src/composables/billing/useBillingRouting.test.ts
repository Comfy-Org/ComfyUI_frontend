import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  BillingRail,
  WorkspaceWithRole
} from '@/platform/workspace/api/workspaceApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import { useBillingRouting } from './useBillingRouting'

const mockIsCloud = vi.hoisted(() => ({ value: true }))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

const personal: WorkspaceWithRole = {
  id: 'w-personal',
  name: 'Personal Workspace',
  type: 'personal',
  role: 'owner',
  created_at: '2026-01-01T00:00:00Z',
  joined_at: '2026-01-01T00:00:00Z'
}
const team: WorkspaceWithRole = {
  ...personal,
  id: 'w-team',
  name: 'Team Workspace',
  type: 'team'
}

function setActiveWorkspace(
  workspace: WorkspaceWithRole | null,
  billingRail: BillingRail | null = null
) {
  const workspaceStore = useTeamWorkspaceStore()
  workspaceStore.$patch({
    activeWorkspaceId: workspace?.id ?? null,
    workspaces: workspace
      ? [
          {
            ...workspace,
            isSubscribed: false,
            subscriptionPlan: null,
            subscriptionTier: null,
            members: [],
            pendingInvites: []
          }
        ]
      : []
  })
  if (workspace && billingRail) {
    workspaceStore.setWorkspaceBillingRail(workspace.id, billingRail)
  }
}

describe('useBillingRouting', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ createSpy: vi.fn, stubActions: false }))
    mockIsCloud.value = true
    setActiveWorkspace(personal)
  })

  it('uses legacy billing off Cloud until a workspace context loads', () => {
    mockIsCloud.value = false
    setActiveWorkspace(null)

    const { type, shouldUseWorkspaceBilling } = useBillingRouting()

    expect(type.value).toBe('legacy')
    expect(shouldUseWorkspaceBilling.value).toBe(false)
  })

  it('uses workspace billing off Cloud once a workspace context loads', () => {
    mockIsCloud.value = false
    setActiveWorkspace(team)

    const { type, shouldUseWorkspaceBilling } = useBillingRouting()

    expect(type.value).toBe('workspace')
    expect(shouldUseWorkspaceBilling.value).toBe(true)
  })

  it('uses workspace billing for a Cloud personal workspace', () => {
    const { type, shouldUseWorkspaceBilling } = useBillingRouting()

    expect(type.value).toBe('workspace')
    expect(shouldUseWorkspaceBilling.value).toBe(true)
  })

  it('uses unified pricing while keeping legacy Stripe top-ups on Checkout', () => {
    setActiveWorkspace(personal, 'legacy_stripe')

    const { type, shouldUseWorkspaceBilling, shouldUseUnifiedPricing } =
      useBillingRouting()

    expect(type.value).toBe('legacy')
    expect(shouldUseWorkspaceBilling.value).toBe(false)
    expect(shouldUseUnifiedPricing.value).toBe(true)
  })

  it('uses workspace billing for migrated Stripe personal workspaces', () => {
    setActiveWorkspace(personal, 'stripe')

    const { type, shouldUseWorkspaceBilling } = useBillingRouting()

    expect(type.value).toBe('workspace')
    expect(shouldUseWorkspaceBilling.value).toBe(true)
  })

  it('uses workspace billing for team workspaces', () => {
    setActiveWorkspace(team, 'legacy_stripe')

    const { type, shouldUseWorkspaceBilling } = useBillingRouting()

    expect(type.value).toBe('workspace')
    expect(shouldUseWorkspaceBilling.value).toBe(true)
  })

  it('defaults to legacy while the workspace has not loaded', () => {
    setActiveWorkspace(null)

    const { type } = useBillingRouting()

    expect(type.value).toBe('legacy')
  })
})
