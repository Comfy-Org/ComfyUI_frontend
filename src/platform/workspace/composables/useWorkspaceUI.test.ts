import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { computed, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkspaceWithRole } from '@/platform/workspace/api/workspaceApi'

const mockIsCloud = vi.hoisted(() => ({ value: true }))
const mockShouldUseWorkspaceBilling = ref(true)
const mockCanReactivate = ref(false)
const mockCanSubscribeSelfServe = ref(true)
const mockSnapshotAuthoritative = ref(true)
const mockIsActiveSubscription = vi.hoisted(() => ({ value: false }))
const mockIsCancelled = vi.hoisted(() => ({ value: false }))
const mockIsTeamPlan = vi.hoisted(() => ({ value: false }))
const mockBillingControlEnabled = vi.hoisted(() => ({ value: false }))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

vi.mock<unknown>(import('@/composables/billing/useBillingRouting'), () => ({
  useBillingRouting: () => ({
    shouldUseWorkspaceBilling: computed(
      () => mockShouldUseWorkspaceBilling.value
    )
  })
}))

vi.mock<unknown>(
  import('@/platform/workspace/composables/useBillingCapabilities'),
  () => ({
    useBillingCapabilities: () => ({
      canReactivate: computed(() => mockCanReactivate.value),
      canSubscribeSelfServe: computed(() => mockCanSubscribeSelfServe.value),
      snapshotAuthoritative: computed(() => mockSnapshotAuthoritative.value)
    })
  })
)

vi.mock<unknown>(import('@/composables/billing/useBillingContext'), () => ({
  useBillingContext: () => ({
    canAccessSubscriptionFeatures: ref(mockIsActiveSubscription.value),
    isTeamPlan: ref(mockIsTeamPlan.value),
    subscription: ref({ isCancelled: mockIsCancelled.value })
  })
}))

vi.mock<unknown>(import('@/composables/useFeatureFlags'), () => ({
  useFeatureFlags: () => ({
    flags: {
      get billingControlEnabled() {
        return mockBillingControlEnabled.value
      }
    }
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
  Object.assign(useTeamWorkspaceStore(), { activeWorkspace: null })
  Object.assign(useTeamWorkspaceStore(), { isCurrentUserOriginalOwner: false })
  Object.assign(useTeamWorkspaceStore(), { originalOwnerId: null })
  mockIsActiveSubscription.value = false
  mockIsCancelled.value = false
  mockIsTeamPlan.value = false
  mockBillingControlEnabled.value = false
  mockIsCloud.value = true
  mockShouldUseWorkspaceBilling.value = true
  mockCanReactivate.value = false
  mockCanSubscribeSelfServe.value = true
  mockSnapshotAuthoritative.value = true
}

beforeEach(() => {
  vi.mocked(useTeamWorkspaceStore().ensureMembersLoaded).mockResolvedValue(
    undefined
  )
})

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
        canDowngradeToPersonal: false
      })
      expect(ui.permissions.value.canViewOtherMembers).toBe(false)
      expect(ui.permissions.value.canLeaveWorkspace).toBe(false)
      expect(ui.permissions.value.canAccessWorkspaceMenu).toBe(false)
      expect(ui.uiConfig.value.showMembersList).toBe(false)
    })
  })

  describe('personal workspace', () => {
    beforeEach(() => {
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspace: personalWorkspace
      })
    })

    it('grants billing access with personal workspace visibility', async () => {
      const ui = await loadComposable()

      expect(ui.workspaceType.value).toBe('personal')
      expect(ui.permissions.value).toMatchObject({
        canManageSubscription: true,
        canManageSubscriptionLifecycle: true,
        canDowngradeToPersonal: false,
        canViewOtherMembers: false,
        canViewPendingInvites: false,
        canLeaveWorkspace: false,
        canAccessWorkspaceMenu: false
      })
    })

    it('gives a Team-plan member only member actions', async () => {
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspace: personalMemberWorkspace
      })
      mockIsTeamPlan.value = true
      const ui = await loadComposable()

      expect(ui.permissions.value).toMatchObject({
        canViewOtherMembers: true,
        canViewPendingInvites: false,
        canLeaveWorkspace: true,
        canAccessWorkspaceMenu: true,
        canManageSubscription: false,
        canManageSubscriptionLifecycle: false,
        canDowngradeToPersonal: false
      })
      expect(ui.uiConfig.value).toMatchObject({
        showEditWorkspaceMenuItem: false,
        workspaceMenuAction: null
      })
    })

    it('withholds leave from a Personal-plan member', async () => {
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspace: personalMemberWorkspace
      })
      const ui = await loadComposable()

      expect(ui.permissions.value.canLeaveWorkspace).toBe(false)
      expect(ui.permissions.value.canAccessWorkspaceMenu).toBe(false)
    })

    it('withholds leave from a Team-plan owner until creator identity resolves', async () => {
      mockIsTeamPlan.value = true
      const ui = await loadComposable()

      expect(ui.permissions.value.canLeaveWorkspace).toBe(false)
      expect(ui.permissions.value.canAccessWorkspaceMenu).toBe(false)
    })

    it('lets a promoted owner leave while using a Team plan', async () => {
      mockIsTeamPlan.value = true
      Object.assign(useTeamWorkspaceStore(), {
        originalOwnerId: 'original-owner'
      })
      const ui = await loadComposable()

      expect(ui.permissions.value.canLeaveWorkspace).toBe(true)
      expect(ui.permissions.value.canAccessWorkspaceMenu).toBe(true)
    })

    it('keeps the original creator from leaving while using a Team plan', async () => {
      mockIsTeamPlan.value = true
      Object.assign(useTeamWorkspaceStore(), {
        originalOwnerId: 'current-user'
      })
      Object.assign(useTeamWorkspaceStore(), {
        isCurrentUserOriginalOwner: true
      })
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
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspace: teamOwnerWorkspace
      })
    })

    it('grants full management permissions', async () => {
      const ui = await loadComposable()

      expect(ui.workspaceType.value).toBe('team')
      expect(ui.workspaceRole.value).toBe('owner')
      expect(ui.permissions.value).toMatchObject({
        canViewOtherMembers: true,
        canViewPendingInvites: true,
        canLeaveWorkspace: true,
        canAccessWorkspaceMenu: true,
        canManageSubscription: true,
        canManageSubscriptionLifecycle: true,
        canDowngradeToPersonal: false
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
      expect(ui.uiConfig.value.showCreditsColumn).toBe(false)
    })

    it('adds the credits column when billing controls are enabled', async () => {
      mockBillingControlEnabled.value = true
      const ui = await loadComposable()

      expect(ui.uiConfig.value.showCreditsColumn).toBe(true)
      expect(ui.uiConfig.value.membersGridCols).toBe(
        'grid-cols-[38%_18%_30%_14%]'
      )
      expect(ui.uiConfig.value.headerGridCols).toBe(
        'grid-cols-[38%_18%_30%_14%]'
      )
    })
  })

  describe('team workspace as member', () => {
    beforeEach(() => {
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspace: teamMemberWorkspace
      })
      mockIsTeamPlan.value = true
    })

    it('restricts management actions while allowing leave', async () => {
      const ui = await loadComposable()

      expect(ui.workspaceRole.value).toBe('member')
      expect(ui.permissions.value).toMatchObject({
        canViewOtherMembers: true,
        canViewPendingInvites: false,
        canLeaveWorkspace: true,
        canAccessWorkspaceMenu: true,
        canManageSubscription: false,
        canManageSubscriptionLifecycle: false,
        canDowngradeToPersonal: false
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
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspace: personalWorkspace
      })
      const ui = await loadComposable()

      expect(ui.isOriginalOwner.value).toBe(false)
      expect(ui.permissions.value.canDowngradeToPersonal).toBe(false)
    })

    it('allows an original owner to downgrade', async () => {
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspace: teamOwnerWorkspace
      })
      Object.assign(useTeamWorkspaceStore(), {
        isCurrentUserOriginalOwner: true
      })
      Object.assign(useTeamWorkspaceStore(), {
        originalOwnerId: 'current-user'
      })
      mockIsTeamPlan.value = true
      const ui = await loadComposable()

      expect(ui.isOriginalOwner.value).toBe(true)
      expect(ui.permissions.value.canDowngradeToPersonal).toBe(true)
      expect(ui.permissions.value.canLeaveWorkspace).toBe(true)
    })

    it('allows an additional workspace owner to leave before creator identity resolves', async () => {
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspace: teamOwnerWorkspace
      })
      mockIsTeamPlan.value = true
      const ui = await loadComposable()

      expect(ui.permissions.value.canLeaveWorkspace).toBe(true)
    })
  })

  describe('subscription lifecycle', () => {
    it('grants lifecycle and downgrade to the original owner', async () => {
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspace: teamOwnerWorkspace
      })
      Object.assign(useTeamWorkspaceStore(), {
        isCurrentUserOriginalOwner: true
      })
      mockIsTeamPlan.value = true
      const ui = await loadComposable()
      expect(ui.permissions.value.canManageSubscription).toBe(true)
      expect(ui.permissions.value.canManageSubscriptionLifecycle).toBe(true)
      expect(ui.permissions.value.canDowngradeToPersonal).toBe(true)
    })

    it('withholds downgrade from an original owner on a Personal plan', async () => {
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspace: teamOwnerWorkspace
      })
      Object.assign(useTeamWorkspaceStore(), {
        isCurrentUserOriginalOwner: true
      })
      const ui = await loadComposable()

      expect(ui.permissions.value.canManageSubscription).toBe(true)
      expect(ui.permissions.value.canDowngradeToPersonal).toBe(false)
    })

    it('grants lifecycle but withholds downgrade from a promoted owner', async () => {
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspace: teamOwnerWorkspace
      })
      Object.assign(useTeamWorkspaceStore(), {
        isCurrentUserOriginalOwner: false
      })
      Object.assign(useTeamWorkspaceStore(), {
        originalOwnerId: 'original-owner'
      })
      mockIsTeamPlan.value = true
      const ui = await loadComposable()
      expect(ui.permissions.value.canManageSubscription).toBe(true)
      expect(ui.permissions.value.canManageSubscriptionLifecycle).toBe(true)
      expect(ui.permissions.value.canDowngradeToPersonal).toBe(false)
      expect(ui.permissions.value.canLeaveWorkspace).toBe(true)
    })

    it('withholds lifecycle from members', async () => {
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspace: teamMemberWorkspace
      })
      const ui = await loadComposable()
      expect(ui.permissions.value.canManageSubscriptionLifecycle).toBe(false)
      expect(ui.permissions.value.canDowngradeToPersonal).toBe(false)
    })
  })

  describe('original-owner data loading', () => {
    it('loads members for a team owner', async () => {
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspace: teamOwnerWorkspace
      })
      await loadComposable()
      expect(useTeamWorkspaceStore().ensureMembersLoaded).toHaveBeenCalled()
    })

    it('loads members for a personal owner', async () => {
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspace: personalWorkspace
      })
      await loadComposable()
      expect(useTeamWorkspaceStore().ensureMembersLoaded).toHaveBeenCalled()
    })

    it('does not load members for a member', async () => {
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspace: personalMemberWorkspace
      })
      await loadComposable()
      expect(useTeamWorkspaceStore().ensureMembersLoaded).not.toHaveBeenCalled()
    })
  })

  describe('cancelled Team plan', () => {
    it('uses plan identity instead of workspace type', async () => {
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspace: personalWorkspace
      })
      mockIsTeamPlan.value = true
      mockIsCancelled.value = true
      const ui = await loadComposable()

      expect(ui.isTeamPlanCancelled.value).toBe(true)
      expect(ui.isSubscriptionCancelled.value).toBe(true)
    })

    it('ignores a cancelled non-Team plan in a team workspace', async () => {
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspace: teamOwnerWorkspace
      })
      mockIsTeamPlan.value = false
      mockIsCancelled.value = true
      const ui = await loadComposable()

      expect(ui.isTeamPlanCancelled.value).toBe(false)
      expect(ui.isSubscriptionCancelled.value).toBe(true)
    })
  })

  describe('shared instance', () => {
    it('returns the same composable state for multiple callers within a test', async () => {
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspace: teamOwnerWorkspace
      })
      const first = await loadComposable()
      const second = await loadComposable()

      expect(second.permissions).toBe(first.permissions)
      expect(second.uiConfig).toBe(first.uiConfig)
    })
  })
  describe('canReactivatePlan', () => {
    beforeEach(() => {
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspace: personalWorkspace
      })
    })

    it('uses the server capability on the consolidated rail', async () => {
      mockShouldUseWorkspaceBilling.value = true
      mockCanReactivate.value = false

      const denied = await loadComposable()
      expect(denied.canReactivatePlan.value).toBe(false)

      vi.resetModules()
      mockCanReactivate.value = true
      const allowed = await loadComposable()
      expect(allowed.canReactivatePlan.value).toBe(true)
    })

    it('falls back to membership on the legacy rail, where no capability row exists', async () => {
      mockShouldUseWorkspaceBilling.value = false
      mockCanReactivate.value = false

      const ui = await loadComposable()
      expect(ui.permissions.value.canManageSubscriptionLifecycle).toBe(true)
      expect(ui.canReactivatePlan.value).toBe(true)
    })

    it('falls back to membership off Cloud, where the endpoint is never called', async () => {
      mockIsCloud.value = false
      mockShouldUseWorkspaceBilling.value = true
      mockCanReactivate.value = false

      const ui = await loadComposable()
      expect(ui.canReactivatePlan.value).toBe(true)
    })
  })

  describe('canOpenPricingSurface', () => {
    beforeEach(() => {
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspace: personalWorkspace
      })
    })

    it('closes the catalog when the server resolves a sales-managed plan', async () => {
      mockShouldUseWorkspaceBilling.value = true
      mockCanSubscribeSelfServe.value = false

      const ui = await loadComposable()
      expect(ui.canOpenPricingSurface.value).toBe(false)
    })

    it('opens the catalog when the server allows self-serve subscribing', async () => {
      mockShouldUseWorkspaceBilling.value = true
      mockCanSubscribeSelfServe.value = true

      const ui = await loadComposable()
      expect(ui.canOpenPricingSurface.value).toBe(true)
    })

    it('falls back to membership on the legacy rail, where no capability row exists', async () => {
      mockShouldUseWorkspaceBilling.value = false
      mockCanSubscribeSelfServe.value = false

      const ui = await loadComposable()
      expect(ui.permissions.value.canManageSubscription).toBe(true)
      expect(ui.canOpenPricingSurface.value).toBe(true)
    })

    it('falls back to membership off Cloud, where the endpoint is never called', async () => {
      mockIsCloud.value = false
      mockShouldUseWorkspaceBilling.value = true
      mockCanSubscribeSelfServe.value = false

      const ui = await loadComposable()
      expect(ui.canOpenPricingSurface.value).toBe(true)
    })

    it('falls back to membership when the snapshot is not authoritative', async () => {
      mockSnapshotAuthoritative.value = false
      mockCanSubscribeSelfServe.value = false

      const ui = await loadComposable()
      expect(ui.canOpenPricingSurface.value).toBe(true)
    })

    it('keeps the catalog closed for a non-owner with no readable snapshot', async () => {
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspace: teamMemberWorkspace
      })
      mockSnapshotAuthoritative.value = false
      mockCanSubscribeSelfServe.value = false

      const ui = await loadComposable()
      expect(ui.permissions.value.canManageSubscription).toBe(false)
      expect(ui.canOpenPricingSurface.value).toBe(false)
    })
  })
})

vi.mock(import('firebase/auth'), async (importOriginal) => ({
  ...(await importOriginal()),
  setPersistence: vi.fn().mockResolvedValue(undefined),
  onAuthStateChanged: vi.fn(() => vi.fn()),
  onIdTokenChanged: vi.fn(() => vi.fn())
}))
