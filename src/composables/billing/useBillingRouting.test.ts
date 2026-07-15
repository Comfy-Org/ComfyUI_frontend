import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useBillingRouting } from './useBillingRouting'

const { mockFlags, mockActiveWorkspace } = vi.hoisted(() => ({
  mockFlags: {
    teamWorkspacesEnabled: false,
    consolidatedBillingEnabled: false
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
    mockFlags.consolidatedBillingEnabled = false
    mockActiveWorkspace.value = personal
  })

  it('uses legacy billing when team workspaces are disabled', () => {
    mockFlags.teamWorkspacesEnabled = false
    mockActiveWorkspace.value = team

    const { type, shouldUseWorkspaceBilling } = useBillingRouting()

    expect(type.value).toBe('legacy')
    expect(shouldUseWorkspaceBilling.value).toBe(false)
  })

  it('keeps personal on legacy when consolidated billing is disabled', () => {
    mockFlags.teamWorkspacesEnabled = true
    mockFlags.consolidatedBillingEnabled = false
    mockActiveWorkspace.value = personal

    const { type } = useBillingRouting()

    expect(type.value).toBe('legacy')
  })

  it('moves personal to workspace billing when consolidated billing is enabled', () => {
    mockFlags.teamWorkspacesEnabled = true
    mockFlags.consolidatedBillingEnabled = true
    mockActiveWorkspace.value = personal

    const { type, shouldUseWorkspaceBilling } = useBillingRouting()

    expect(type.value).toBe('workspace')
    expect(shouldUseWorkspaceBilling.value).toBe(true)
  })

  it('uses workspace billing for team workspaces regardless of consolidated billing', () => {
    mockFlags.teamWorkspacesEnabled = true
    mockFlags.consolidatedBillingEnabled = false
    mockActiveWorkspace.value = team

    const { type, shouldUseWorkspaceBilling } = useBillingRouting()

    expect(type.value).toBe('workspace')
    expect(shouldUseWorkspaceBilling.value).toBe(true)
  })

  it('uses workspace billing for team workspaces with consolidated billing enabled', () => {
    mockFlags.teamWorkspacesEnabled = true
    mockFlags.consolidatedBillingEnabled = true
    mockActiveWorkspace.value = team

    const { type, shouldUseWorkspaceBilling } = useBillingRouting()

    expect(type.value).toBe('workspace')
    expect(shouldUseWorkspaceBilling.value).toBe(true)
  })

  it('defaults to legacy while the workspace has not loaded', () => {
    mockFlags.teamWorkspacesEnabled = true
    mockFlags.consolidatedBillingEnabled = true
    mockActiveWorkspace.value = null

    const { type } = useBillingRouting()

    expect(type.value).toBe('legacy')
  })
})
