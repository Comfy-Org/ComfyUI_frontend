import { ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkspaceWithRole } from '@/platform/workspace/api/workspaceApi'
import type { WorkspaceMember } from '@/platform/workspace/stores/teamWorkspaceStore'

const mockActiveWorkspace = vi.hoisted(() => ({
  value: null as WorkspaceWithRole | null
}))
const mockMembers = vi.hoisted(() => ({ value: [] as WorkspaceMember[] }))
const mockUserEmail = vi.hoisted(() => ({ value: null as string | null }))
const mockIsActiveSubscription = vi.hoisted(() => ({ value: false }))
const mockIsCancelled = vi.hoisted(() => ({ value: false }))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    get activeWorkspace() {
      return mockActiveWorkspace.value
    },
    get isInPersonalWorkspace() {
      return mockActiveWorkspace.value?.type === 'personal'
    },
    get isWorkspaceSubscribed() {
      return false
    },
    get members() {
      return mockMembers.value
    }
  })
}))

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({ userEmail: ref(mockUserEmail.value) })
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    isActiveSubscription: ref(mockIsActiveSubscription.value),
    subscription: ref({ isCancelled: mockIsCancelled.value })
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

describe('useWorkspaceUI', () => {
  beforeEach(() => {
    vi.resetModules()
    mockActiveWorkspace.value = null
    mockMembers.value = []
    mockUserEmail.value = null
    mockIsActiveSubscription.value = false
    mockIsCancelled.value = false
  })

  afterEach(() => {
    mockActiveWorkspace.value = null
    mockMembers.value = []
    mockUserEmail.value = null
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
      mockActiveWorkspace.value = personalWorkspace
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

    it('lets the personal owner rename their workspace', async () => {
      const ui = await loadComposable()

      expect(ui.uiConfig.value).toMatchObject({
        showMembersList: false,
        showPendingTab: false,
        showSearch: false,
        showDateColumn: false,
        showRoleBadge: false,
        showEditWorkspaceMenuItem: true,
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
      mockActiveWorkspace.value = teamOwnerWorkspace
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
      mockActiveWorkspace.value = teamMemberWorkspace
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

  describe('isOriginalOwner', () => {
    const earlier = new Date('2026-01-01T00:00:00Z')

    function member(
      id: string,
      email: string,
      joinDate: Date
    ): WorkspaceMember {
      return { id, name: id, email, joinDate, role: 'owner' }
    }

    beforeEach(() => {
      mockActiveWorkspace.value = teamOwnerWorkspace
    })

    it('treats the personal owner as their own original owner', async () => {
      mockActiveWorkspace.value = personalWorkspace
      const ui = await loadComposable()

      expect(ui.isOriginalOwner.value).toBe(true)
    })

    it('names the earliest-joined member as the original owner', async () => {
      mockMembers.value = [
        member('m2', 'late@example.com', new Date('2026-02-01T00:00:00Z')),
        member('m1', 'early@example.com', earlier)
      ]
      mockUserEmail.value = 'early@example.com'
      const ui = await loadComposable()

      expect(ui.isOriginalOwner.value).toBe(true)
    })

    it('breaks join-date ties with the member id so only one is the owner', async () => {
      mockMembers.value = [
        member('m-b', 'b@example.com', earlier),
        member('m-a', 'a@example.com', earlier)
      ]

      mockUserEmail.value = 'a@example.com'
      const owner = await loadComposable()
      expect(owner.isOriginalOwner.value).toBe(true)

      vi.resetModules()
      mockUserEmail.value = 'b@example.com'
      const notOwner = await loadComposable()
      expect(notOwner.isOriginalOwner.value).toBe(false)
    })
  })

  describe('shared instance', () => {
    it('returns the same composable state for multiple callers within a test', async () => {
      mockActiveWorkspace.value = teamOwnerWorkspace
      const first = await loadComposable()
      const second = await loadComposable()

      expect(second.permissions).toBe(first.permissions)
      expect(second.uiConfig).toBe(first.uiConfig)
    })
  })
})
