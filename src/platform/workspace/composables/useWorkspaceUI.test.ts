import { ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkspaceWithRole } from '@/platform/workspace/api/workspaceApi'

const mockStore = vi.hoisted(() => ({
  activeWorkspace: null as WorkspaceWithRole | null,
  isCurrentUserOriginalOwner: false,
  originalOwnerId: null as string | null,
  ensureMembersLoaded: vi.fn()
}))
const mockIsActiveSubscription = vi.hoisted(() => ({ value: false }))
const mockIsCancelled = vi.hoisted(() => ({ value: false }))
const mockIsTeamPlan = vi.hoisted(() => ({ value: false }))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    get activeWorkspace() {
      return mockStore.activeWorkspace
    },
    get isInPersonalWorkspace() {
      return mockStore.activeWorkspace?.type === 'personal'
    },
    get isWorkspaceSubscribed() {
      return false
    },
    get isCurrentUserOriginalOwner() {
      return mockStore.isCurrentUserOriginalOwner
    },
    get originalOwnerId() {
      return mockStore.originalOwnerId
    },
    ensureMembersLoaded: mockStore.ensureMembersLoaded
  })
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    isActiveSubscription: ref(mockIsActiveSubscription.value),
    isTeamPlan: ref(mockIsTeamPlan.value),
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

const personalMemberWorkspace: WorkspaceWithRole = {
  ...personalWorkspace,
  id: 'ws-personal-member',
  role: 'member'
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
  mockStore.originalOwnerId = null
  mockStore.ensureMembersLoaded.mockReset()
  mockIsActiveSubscription.value = false
  mockIsCancelled.value = false
  mockIsTeamPlan.value = false
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
    it('fails billing permissions closed', async () => {
      mockIsTeamPlan.value = true
      const ui = await loadComposable()

      expect(ui.workspaceType.value).toBe('personal')
      expect(ui.workspaceRole.value).toBe('owner')
      expect(ui.permissions.value).toMatchObject({
        canManageSubscription: false,
        canManageSubscriptionLifecycle: false,
        canDowngradeToPersonal: false,
        canTopUp: false
      })
      expect(ui.permissions.value.canViewOtherMembers).toBe(false)
      expect(ui.permissions.value.canLeaveWorkspace).toBe(false)
      expect(ui.permissions.value.canAccessWorkspaceMenu).toBe(false)
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
        canManageSubscriptionLifecycle: true,
        canDowngradeToPersonal: false,
        canTopUp: true,
        canViewOtherMembers: false,
        canViewPendingInvites: false,
        canInviteMembers: false,
        canManageInvites: false,
        canManageMembers: false,
        canLeaveWorkspace: false,
        canAccessWorkspaceMenu: false
      })
    })

    it('gives a Team-plan member only member actions', async () => {
      mockStore.activeWorkspace = personalMemberWorkspace
      mockIsTeamPlan.value = true
      const ui = await loadComposable()

      expect(ui.permissions.value).toMatchObject({
        canViewOtherMembers: true,
        canViewPendingInvites: false,
        canInviteMembers: false,
        canManageInvites: false,
        canManageMembers: false,
        canLeaveWorkspace: true,
        canAccessWorkspaceMenu: true,
        canManageSubscription: false,
        canManageSubscriptionLifecycle: false,
        canDowngradeToPersonal: false,
        canTopUp: false
      })
      expect(ui.uiConfig.value).toMatchObject({
        showEditWorkspaceMenuItem: false,
        workspaceMenuAction: null
      })
    })

    it('withholds leave from a Personal-plan member', async () => {
      mockStore.activeWorkspace = personalMemberWorkspace
      const ui = await loadComposable()

      expect(ui.permissions.value.canLeaveWorkspace).toBe(false)
      expect(ui.permissions.value.canAccessWorkspaceMenu).toBe(false)
    })

    it('lets a promoted owner leave while using a Team plan', async () => {
      mockIsTeamPlan.value = true
      mockStore.originalOwnerId = 'original-owner'
      const ui = await loadComposable()

      expect(ui.permissions.value.canLeaveWorkspace).toBe(true)
      expect(ui.permissions.value.canAccessWorkspaceMenu).toBe(true)
    })

    it('keeps the original creator from leaving while using a Team plan', async () => {
      mockIsTeamPlan.value = true
      mockStore.originalOwnerId = 'current-user'
      mockStore.isCurrentUserOriginalOwner = true
      const ui = await loadComposable()

      expect(ui.permissions.value.canLeaveWorkspace).toBe(false)
      expect(ui.permissions.value.canAccessWorkspaceMenu).toBe(false)
    })

    it('lets the personal owner rename their workspace', async () => {
      const ui = await loadComposable()

      expect(ui.uiConfig.value).toMatchObject({
        showMembersList: false,
        showPendingTab: false,
        showSearch: false,
        showRoleColumn: false,
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
        canManageMembers: true,
        canLeaveWorkspace: true,
        canAccessWorkspaceMenu: true,
        canManageSubscription: true,
        canManageSubscriptionLifecycle: true,
        canDowngradeToPersonal: false,
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
      mockIsTeamPlan.value = true
    })

    it('restricts management actions while allowing leave', async () => {
      const ui = await loadComposable()

      expect(ui.workspaceRole.value).toBe('member')
      expect(ui.permissions.value).toMatchObject({
        canViewOtherMembers: true,
        canViewPendingInvites: false,
        canInviteMembers: false,
        canManageInvites: false,
        canManageMembers: false,
        canLeaveWorkspace: true,
        canAccessWorkspaceMenu: true,
        canManageSubscription: false,
        canManageSubscriptionLifecycle: false,
        canDowngradeToPersonal: false,
        canTopUp: false
      })
    })

    it('shows members but hides invite management and uses leave action', async () => {
      const ui = await loadComposable()

      expect(ui.uiConfig.value.showMembersList).toBe(true)
      expect(ui.uiConfig.value.showPendingTab).toBe(false)
      expect(ui.uiConfig.value.showEditWorkspaceMenuItem).toBe(false)
      expect(ui.uiConfig.value.workspaceMenuAction).toBeNull()
      expect(ui.uiConfig.value.workspaceMenuDisabledTooltip).toBeNull()
      expect(ui.uiConfig.value.membersGridCols).toBe('grid-cols-[1fr_auto]')
      expect(ui.uiConfig.value.headerGridCols).toBe('grid-cols-[1fr_auto]')
      expect(ui.uiConfig.value.pendingGridCols).toBe(
        'grid-cols-[50%_20%_20%_10%]'
      )
    })

    it('allows leave independently of the active plan', async () => {
      mockIsTeamPlan.value = false
      const ui = await loadComposable()

      expect(ui.permissions.value.canLeaveWorkspace).toBe(true)
      expect(ui.permissions.value.canAccessWorkspaceMenu).toBe(true)
    })
  })

  describe('original-owner permissions', () => {
    it('uses the canonical store signal for personal workspaces', async () => {
      mockStore.activeWorkspace = personalWorkspace
      const ui = await loadComposable()

      expect(ui.isOriginalOwner.value).toBe(false)
      expect(ui.permissions.value.canDowngradeToPersonal).toBe(false)
    })

    it('allows an original owner to downgrade', async () => {
      mockStore.activeWorkspace = teamOwnerWorkspace
      mockStore.isCurrentUserOriginalOwner = true
      mockStore.originalOwnerId = 'current-user'
      mockIsTeamPlan.value = true
      const ui = await loadComposable()

      expect(ui.isOriginalOwner.value).toBe(true)
      expect(ui.permissions.value.canDowngradeToPersonal).toBe(true)
      expect(ui.permissions.value.canLeaveWorkspace).toBe(true)
    })

    it('allows an additional workspace owner to leave before creator identity resolves', async () => {
      mockStore.activeWorkspace = teamOwnerWorkspace
      mockIsTeamPlan.value = true
      const ui = await loadComposable()

      expect(ui.permissions.value.canLeaveWorkspace).toBe(true)
    })
  })

  describe('subscription lifecycle', () => {
    it('grants lifecycle and downgrade to the original owner', async () => {
      mockStore.activeWorkspace = teamOwnerWorkspace
      mockStore.isCurrentUserOriginalOwner = true
      mockIsTeamPlan.value = true
      const ui = await loadComposable()
      expect(ui.permissions.value.canManageSubscription).toBe(true)
      expect(ui.permissions.value.canManageSubscriptionLifecycle).toBe(true)
      expect(ui.permissions.value.canDowngradeToPersonal).toBe(true)
    })

    it('withholds downgrade from an original owner on a Personal plan', async () => {
      mockStore.activeWorkspace = teamOwnerWorkspace
      mockStore.isCurrentUserOriginalOwner = true
      const ui = await loadComposable()

      expect(ui.permissions.value.canManageSubscription).toBe(true)
      expect(ui.permissions.value.canDowngradeToPersonal).toBe(false)
    })

    it('grants lifecycle but withholds downgrade from a promoted owner', async () => {
      mockStore.activeWorkspace = teamOwnerWorkspace
      mockStore.isCurrentUserOriginalOwner = false
      mockStore.originalOwnerId = 'original-owner'
      mockIsTeamPlan.value = true
      const ui = await loadComposable()
      expect(ui.permissions.value.canManageSubscription).toBe(true)
      expect(ui.permissions.value.canManageSubscriptionLifecycle).toBe(true)
      expect(ui.permissions.value.canDowngradeToPersonal).toBe(false)
      expect(ui.permissions.value.canLeaveWorkspace).toBe(true)
    })

    it('withholds lifecycle from members', async () => {
      mockStore.activeWorkspace = teamMemberWorkspace
      const ui = await loadComposable()
      expect(ui.permissions.value.canManageSubscriptionLifecycle).toBe(false)
      expect(ui.permissions.value.canDowngradeToPersonal).toBe(false)
    })
  })

  describe('original-owner data loading', () => {
    it('loads members for a team owner', async () => {
      mockStore.activeWorkspace = teamOwnerWorkspace
      await loadComposable()
      expect(mockStore.ensureMembersLoaded).toHaveBeenCalled()
    })

    it('loads members for a personal owner', async () => {
      mockStore.activeWorkspace = personalWorkspace
      await loadComposable()
      expect(mockStore.ensureMembersLoaded).toHaveBeenCalled()
    })

    it('does not load members for a member', async () => {
      mockStore.activeWorkspace = personalMemberWorkspace
      await loadComposable()
      expect(mockStore.ensureMembersLoaded).not.toHaveBeenCalled()
    })
  })

  describe('cancelled Team plan', () => {
    it('uses plan identity instead of workspace type', async () => {
      mockStore.activeWorkspace = personalWorkspace
      mockIsTeamPlan.value = true
      mockIsCancelled.value = true
      const ui = await loadComposable()

      expect(ui.isTeamPlanCancelled.value).toBe(true)
      expect(ui.isSubscriptionCancelled.value).toBe(true)
    })

    it('ignores a cancelled non-Team plan in a team workspace', async () => {
      mockStore.activeWorkspace = teamOwnerWorkspace
      mockIsTeamPlan.value = false
      mockIsCancelled.value = true
      const ui = await loadComposable()

      expect(ui.isTeamPlanCancelled.value).toBe(false)
      expect(ui.isSubscriptionCancelled.value).toBe(true)
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
