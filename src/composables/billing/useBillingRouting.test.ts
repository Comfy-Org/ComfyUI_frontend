import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useBillingRouting } from './useBillingRouting'

const { mockFlags, mockActiveWorkspace } = vi.hoisted(() => ({
  mockFlags: {
    teamWorkspacesEnabled: false,
    billingControlEnabled: false
  },
  mockActiveWorkspace: {
    value: null as { id: string; type: 'personal' | 'team' } | null
  }
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({ flags: mockFlags })
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    get activeWorkspace() {
      return mockActiveWorkspace.value
    }
  })
}))

const personal = { id: 'w-personal', type: 'personal' as const }
const team = { id: 'w-team', type: 'team' as const }

describe('useBillingRouting', () => {
  beforeEach(() => {
    mockFlags.teamWorkspacesEnabled = false
    mockFlags.billingControlEnabled = false
    mockActiveWorkspace.value = personal
  })

  it('uses legacy billing when team workspaces are disabled', () => {
    mockFlags.teamWorkspacesEnabled = false
    mockActiveWorkspace.value = team

    const { type, shouldUseWorkspaceBilling } = useBillingRouting()

    expect(type.value).toBe('legacy')
    expect(shouldUseWorkspaceBilling.value).toBe(false)
  })

  it('keeps personal on legacy when billing control is disabled', () => {
    mockFlags.teamWorkspacesEnabled = true
    mockFlags.billingControlEnabled = false
    mockActiveWorkspace.value = personal

    const { type } = useBillingRouting()

    expect(type.value).toBe('legacy')
  })

  it('moves personal to workspace billing when billing control is enabled', () => {
    mockFlags.teamWorkspacesEnabled = true
    mockFlags.billingControlEnabled = true
    mockActiveWorkspace.value = personal

    const { type, shouldUseWorkspaceBilling } = useBillingRouting()

    expect(type.value).toBe('workspace')
    expect(shouldUseWorkspaceBilling.value).toBe(true)
  })

  it('uses workspace billing for team workspaces regardless of billing control', () => {
    mockFlags.teamWorkspacesEnabled = true
    mockFlags.billingControlEnabled = false
    mockActiveWorkspace.value = team

    const { type, shouldUseWorkspaceBilling } = useBillingRouting()

    expect(type.value).toBe('workspace')
    expect(shouldUseWorkspaceBilling.value).toBe(true)
  })

  it('uses workspace billing for team workspaces with billing control enabled', () => {
    mockFlags.teamWorkspacesEnabled = true
    mockFlags.billingControlEnabled = true
    mockActiveWorkspace.value = team

    const { type, shouldUseWorkspaceBilling } = useBillingRouting()

    expect(type.value).toBe('workspace')
    expect(shouldUseWorkspaceBilling.value).toBe(true)
  })

  it('defaults to legacy while the workspace has not loaded', () => {
    mockFlags.teamWorkspacesEnabled = true
    mockFlags.billingControlEnabled = true
    mockActiveWorkspace.value = null

    const { type } = useBillingRouting()

    expect(type.value).toBe('legacy')
  })
})
