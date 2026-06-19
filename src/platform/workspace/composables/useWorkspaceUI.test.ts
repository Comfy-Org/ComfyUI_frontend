import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkspaceWithRole } from '@/platform/workspace/api/workspaceApi'

const mockStore = vi.hoisted(() => ({
  activeWorkspace: null as WorkspaceWithRole | null,
  isCurrentUserOriginalOwner: false,
  ensureMembersLoaded: vi.fn()
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    get activeWorkspace() {
      return mockStore.activeWorkspace
    },
    get isCurrentUserOriginalOwner() {
      return mockStore.isCurrentUserOriginalOwner
    },
    ensureMembersLoaded: mockStore.ensureMembersLoaded
  })
}))

const personalWorkspace: WorkspaceWithRole = {
  id: 'ws-personal',
  name: 'Personal',
  type: 'personal',
  role: 'owner',
  created_at: '2026-01-01T00:00:00Z',
  joined_at: '2026-01-01T00:00:00Z'
}

const teamOwnerWorkspace: WorkspaceWithRole = {
  id: 'ws-team-owner',
  name: 'Team Alpha',
  type: 'team',
  role: 'owner',
  created_at: '2026-02-01T00:00:00Z',
  joined_at: '2026-02-01T00:00:00Z'
}

const teamMemberWorkspace: WorkspaceWithRole = {
  id: 'ws-team-member',
  name: 'Team Beta',
  type: 'team',
  role: 'member',
  created_at: '2026-03-01T00:00:00Z',
  joined_at: '2026-03-01T00:00:00Z'
}

async function loadComposable() {
  const module = await import('@/platform/workspace/composables/useWorkspaceUI')
  return module.useWorkspaceUI()
}

function resetStore() {
  mockStore.activeWorkspace = null
  mockStore.isCurrentUserOriginalOwner = false
  mockStore.ensureMembersLoaded.mockReset()
}

describe('useWorkspaceUI', () => {
  beforeEach(() => {
    vi.resetModules()
    resetStore()
  })

  afterEach(() => {
    resetStore()
  })

  describe('when no active workspace', () => {
    it('defaults to personal workspace behavior', async () => {
      const ui = await loadComposable()

      expect(ui.workspaceType.value).toBe('personal')
      expect(ui.workspaceRole.value).toBe('owner')
      expect(ui.permissions.value.canManageSubscription).toBe(true)
      expect(ui.permissions.value.canTopUp).toBe(true)
      expect(ui.permissions.value.canViewOtherMembers).toBe(false)
      expect(ui.uiConfig.value.showMembersList).toBe(false)
    })
  })

  describe('personal workspace', () => {
    beforeEach(() => {
      mockStore.activeWorkspace = personalWorkspace
    })

    it('grants billing access but disables team management', async () => {
      const ui = await loadComposable()

      expect(ui.workspaceType.value).toBe('personal')
      expect(ui.permissions.value).toMatchObject({
        canManageSubscription: true,
        canTopUp: true,
        canViewOtherMembers: false,
        canViewPendingInvites: false,
        canInviteMembers: false,
        canManageInvites: false,
        canRemoveMembers: false,
        canLeaveWorkspace: false,
        canAccessWorkspaceMenu: false
      })
    })

    it('hides multi-member UI elements', async () => {
      const ui = await loadComposable()

      expect(ui.uiConfig.value).toMatchObject({
        showMembersList: false,
        showPendingTab: false,
        showSearch: false,
        showRoleColumn: false,
        showEditWorkspaceMenuItem: false,
        workspaceMenuAction: null,
        workspaceMenuDisabledTooltip: null
      })
    })

    it('uses single-column grids for the collapsed personal layout', async () => {
      const ui = await loadComposable()

      expect(ui.uiConfig.value.membersGridCols).toBe('grid-cols-1')
      expect(ui.uiConfig.value.headerGridCols).toBe('grid-cols-1')
      expect(ui.uiConfig.value.pendingGridCols).toBe(
        'grid-cols-[50%_20%_20%_10%]'
      )
    })
  })

  describe('team workspace as owner', () => {
    beforeEach(() => {
      mockStore.activeWorkspace = teamOwnerWorkspace
    })

    it('grants full management permissions', async () => {
      const ui = await loadComposable()

      expect(ui.workspaceType.value).toBe('team')
      expect(ui.workspaceRole.value).toBe('owner')
      expect(ui.permissions.value).toMatchObject({
        canViewOtherMembers: true,
        canViewPendingInvites: true,
        canInviteMembers: true,
        canManageInvites: true,
        canRemoveMembers: true,
        canLeaveWorkspace: true,
        canAccessWorkspaceMenu: true,
        canManageSubscription: true,
        canTopUp: true
      })
    })

    it('exposes owner-specific UI chrome including delete action', async () => {
      const ui = await loadComposable()

      expect(ui.uiConfig.value.showPendingTab).toBe(true)
      expect(ui.uiConfig.value.showEditWorkspaceMenuItem).toBe(true)
      expect(ui.uiConfig.value.workspaceMenuAction).toBe('delete')
      expect(ui.uiConfig.value.workspaceMenuDisabledTooltip).toBe(
        'workspacePanel.menu.deleteWorkspaceDisabledTooltip'
      )
      expect(ui.uiConfig.value.membersGridCols).toBe('grid-cols-[50%_40%_10%]')
      expect(ui.uiConfig.value.headerGridCols).toBe('grid-cols-[50%_40%_10%]')
      expect(ui.uiConfig.value.pendingGridCols).toBe(
        'grid-cols-[50%_20%_20%_10%]'
      )
    })
  })

  describe('team workspace as member', () => {
    beforeEach(() => {
      mockStore.activeWorkspace = teamMemberWorkspace
    })

    it('restricts management actions while allowing leave', async () => {
      const ui = await loadComposable()

      expect(ui.workspaceRole.value).toBe('member')
      expect(ui.permissions.value).toMatchObject({
        canViewOtherMembers: true,
        canViewPendingInvites: false,
        canInviteMembers: false,
        canManageInvites: false,
        canRemoveMembers: false,
        canLeaveWorkspace: true,
        canAccessWorkspaceMenu: true,
        canManageSubscription: false,
        canTopUp: false
      })
    })

    it('shows members but hides invite management and uses leave action', async () => {
      const ui = await loadComposable()

      expect(ui.uiConfig.value.showMembersList).toBe(true)
      expect(ui.uiConfig.value.showPendingTab).toBe(false)
      expect(ui.uiConfig.value.showEditWorkspaceMenuItem).toBe(false)
      expect(ui.uiConfig.value.workspaceMenuAction).toBe('leave')
      expect(ui.uiConfig.value.workspaceMenuDisabledTooltip).toBeNull()
      expect(ui.uiConfig.value.membersGridCols).toBe('grid-cols-[1fr_auto]')
      expect(ui.uiConfig.value.headerGridCols).toBe('grid-cols-[1fr_auto]')
      expect(ui.uiConfig.value.pendingGridCols).toBe(
        'grid-cols-[50%_20%_20%_10%]'
      )
    })
  })

  // Drives off the members-list self-row original-owner signal, surfaced by the
  // store getter `isCurrentUserOriginalOwner`.
  describe('subscription lifecycle (creator-only)', () => {
    it('grants lifecycle to the personal-workspace sole owner', async () => {
      mockStore.activeWorkspace = personalWorkspace
      const ui = await loadComposable()
      expect(ui.permissions.value.canManageSubscriptionLifecycle).toBe(true)
    })

    it('grants lifecycle to a team owner who is the original owner', async () => {
      mockStore.activeWorkspace = teamOwnerWorkspace
      mockStore.isCurrentUserOriginalOwner = true
      const ui = await loadComposable()
      expect(ui.permissions.value.canManageSubscription).toBe(true)
      expect(ui.permissions.value.canManageSubscriptionLifecycle).toBe(true)
    })

    it('withholds lifecycle from a promoted (non-creator) team owner', async () => {
      mockStore.activeWorkspace = teamOwnerWorkspace
      mockStore.isCurrentUserOriginalOwner = false
      const ui = await loadComposable()
      expect(ui.permissions.value.canManageSubscription).toBe(true)
      expect(ui.permissions.value.canManageSubscriptionLifecycle).toBe(false)
    })

    it('fails closed while the members list is still loading', async () => {
      mockStore.activeWorkspace = teamOwnerWorkspace
      mockStore.isCurrentUserOriginalOwner = false
      const ui = await loadComposable()
      expect(ui.permissions.value.canManageSubscriptionLifecycle).toBe(false)
    })

    it('withholds lifecycle from members', async () => {
      mockStore.activeWorkspace = teamMemberWorkspace
      const ui = await loadComposable()
      expect(ui.permissions.value.canManageSubscriptionLifecycle).toBe(false)
    })

    it('delegates member loading to the store when a workspace becomes active', async () => {
      mockStore.activeWorkspace = teamOwnerWorkspace
      await loadComposable()
      expect(mockStore.ensureMembersLoaded).toHaveBeenCalled()
    })
  })

  describe('shared instance', () => {
    it('returns the same composable state for multiple callers within a test', async () => {
      mockStore.activeWorkspace = teamOwnerWorkspace
      const first = await loadComposable()
      const second = await loadComposable()

      expect(second.permissions).toBe(first.permissions)
      expect(second.uiConfig).toBe(first.uiConfig)
    })
  })
})
