import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { computed, effectScope, ref } from 'vue'
import type { EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useBillingRouting } from '@/composables/billing/useBillingRouting'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { WorkspaceWithRole } from '@/platform/workspace/api/workspaceApi'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'

const mockIsCloud = vi.hoisted(() => ({ value: true }))
const mockShouldUseWorkspaceBilling = ref(true)
const mockIsActiveSubscription = vi.hoisted(() => ({ value: false }))
const mockIsCancelled = vi.hoisted(() => ({ value: false }))
const mockIsTeamPlan = vi.hoisted(() => ({ value: false }))
const mockMemberCreditLimitsEnabled = vi.hoisted(() => ({ value: false }))
const mockCanReactivate = ref(false)
const mockCanLeaveWorkspace = ref(false)
const mockCanManageSubscription = ref(false)
const mockCanDowngradeToPersonal = ref(false)

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

vi.mock(import('@/composables/billing/useBillingRouting'))

vi.mock(import('@/platform/workspace/composables/useBillingCapabilities'))

vi.mock(import('@/composables/billing/useBillingContext'))

vi.mock(import('@/composables/useFeatureFlags'))

const { useWorkspaceUI } =
  await import('@/platform/workspace/composables/useWorkspaceUI')
let composableScope: EffectScope

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

function loadComposable() {
  vi.mocked(useFeatureFlags().flags).memberCreditLimitsEnabled =
    mockMemberCreditLimitsEnabled.value
  const ui = composableScope.run(useWorkspaceUI)
  if (!ui) throw new Error('Composable scope is inactive')
  return ui
}

function resetStore() {
  Object.assign(useTeamWorkspaceStore(), { activeWorkspace: null })
  mockIsActiveSubscription.value = false
  mockIsCancelled.value = false
  mockIsTeamPlan.value = false
  mockMemberCreditLimitsEnabled.value = false
  mockCanReactivate.value = false
  mockCanLeaveWorkspace.value = false
  mockCanManageSubscription.value = false
  mockCanDowngradeToPersonal.value = false
  mockIsCloud.value = true
  mockShouldUseWorkspaceBilling.value = true
}

beforeEach(() => {
  vi.mocked(useTeamWorkspaceStore().ensureMembersLoaded).mockResolvedValue(
    undefined
  )
})

describe('useWorkspaceUI', { tags: ['shared-state'] }, () => {
  beforeEach(() => {
    resetStore()
    composableScope = effectScope()
    const billingContext = useBillingContext()
    billingContext.canAccessSubscriptionFeatures = computed(
      () => mockIsActiveSubscription.value
    )
    billingContext.isTeamPlan = computed(() => mockIsTeamPlan.value)
    billingContext.subscription = computed(() => ({
      isActive: true,
      tier: null,
      duration: null,
      planSlug: null,
      scheduledChange: null,
      renewalDate: null,
      endDate: null,
      hasFunds: true,
      agentHasFunds: true,
      isCancelled: mockIsCancelled.value
    }))
    vi.mocked(useBillingContext).mockReturnValue(billingContext)
    useBillingRouting().shouldUseWorkspaceBilling = computed(
      () => mockShouldUseWorkspaceBilling.value
    )
    Object.assign(useBillingCapabilities(), {
      canReactivate: computed(() => mockCanReactivate.value),
      canLeaveWorkspace: computed(() => mockCanLeaveWorkspace.value),
      canManageSubscription: computed(() => mockCanManageSubscription.value),
      canDowngradeToPersonal: computed(() => mockCanDowngradeToPersonal.value),
      canSubscribeSelfServe: computed(() => true),
      snapshotAuthoritative: computed(() => true)
    })
  })

  afterEach(() => {
    composableScope.stop()
    resetStore()
  })

  describe('when no active workspace', () => {
    it('falls back to the personal owner layout', async () => {
      const ui = await loadComposable()

      expect(ui.workspaceType.value).toBe('personal')
      expect(ui.workspaceRole.value).toBe('owner')
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

    it('hides other members from the personal owner', async () => {
      const ui = await loadComposable()

      expect(ui.workspaceType.value).toBe('personal')
      expect(ui.permissions.value).toMatchObject({
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
      mockCanLeaveWorkspace.value = true
      const ui = await loadComposable()

      expect(ui.permissions.value).toMatchObject({
        canViewOtherMembers: true,
        canViewPendingInvites: false,
        canLeaveWorkspace: true,
        canAccessWorkspaceMenu: true
      })
      expect(ui.uiConfig.value).toMatchObject({
        showEditWorkspaceMenuItem: false,
        workspaceMenuAction: null
      })
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

    it('shows members and pending invites to the team owner', async () => {
      mockCanLeaveWorkspace.value = true
      const ui = await loadComposable()

      expect(ui.workspaceType.value).toBe('team')
      expect(ui.workspaceRole.value).toBe('owner')
      expect(ui.permissions.value).toMatchObject({
        canViewOtherMembers: true,
        canViewPendingInvites: true,
        canLeaveWorkspace: true,
        canAccessWorkspaceMenu: true
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

    it('keeps the credits column hidden under billing controls alone', async () => {
      vi.mocked(useFeatureFlags().flags).billingControlEnabled = true
      const ui = await loadComposable()

      expect(ui.uiConfig.value.showCreditsColumn).toBe(false)
    })

    it('adds the credits column when member credit limits are enabled', async () => {
      mockMemberCreditLimitsEnabled.value = true
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

    it('hides pending invites from a team member allowed to leave', async () => {
      mockCanLeaveWorkspace.value = true
      const ui = await loadComposable()

      expect(ui.workspaceRole.value).toBe('member')
      expect(ui.permissions.value).toMatchObject({
        canViewOtherMembers: true,
        canViewPendingInvites: false,
        canLeaveWorkspace: true,
        canAccessWorkspaceMenu: true
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
  })

  describe('server-fact gates', () => {
    const served = { leave: true, manage: true, downgrade: true }
    const withheld = { leave: false, manage: false, downgrade: false }
    const factRows = [
      { facts: 'all served', ...served },
      { facts: 'all withheld', ...withheld },
      { facts: 'only can_leave_workspace', ...withheld, leave: true },
      { facts: 'only can_manage_subscription', ...withheld, manage: true },
      { facts: 'only can_downgrade_to_personal', ...withheld, downgrade: true }
    ]
    const actorRows = [
      { actor: 'a personal owner', workspace: personalWorkspace, ...withheld },
      { actor: 'a team owner', workspace: teamOwnerWorkspace, ...withheld },
      {
        actor: 'a personal member',
        workspace: personalMemberWorkspace,
        ...served
      },
      { actor: 'a team member', workspace: teamMemberWorkspace, ...served }
    ]

    it.for([
      ...factRows.map((row) => ({
        actor: 'a team member',
        workspace: teamMemberWorkspace,
        ...row
      })),
      ...actorRows.map((row) => ({
        facts: row.leave ? 'all served' : 'all withheld',
        ...row
      }))
    ])(
      'renders $facts as served for $actor',
      async ({ workspace, leave, manage, downgrade }) => {
        Object.assign(useTeamWorkspaceStore(), { activeWorkspace: workspace })
        mockCanLeaveWorkspace.value = leave
        mockCanManageSubscription.value = manage
        mockCanDowngradeToPersonal.value = downgrade
        const ui = await loadComposable()

        expect(ui.permissions.value).toMatchObject({
          canLeaveWorkspace: leave,
          canManageSubscription: manage,
          canManageSubscriptionLifecycle: manage,
          canDowngradeToPersonal: downgrade
        })
      }
    )

    it.for([
      { actor: 'a team member', workspace: teamMemberWorkspace, leave: true },
      { actor: 'a team member', workspace: teamMemberWorkspace, leave: false },
      { actor: 'a personal owner', workspace: personalWorkspace, leave: true },
      { actor: 'a personal owner', workspace: personalWorkspace, leave: false }
    ])(
      'opens the menu for $actor only through can_leave_workspace $leave',
      async ({ workspace, leave }) => {
        Object.assign(useTeamWorkspaceStore(), { activeWorkspace: workspace })
        mockCanLeaveWorkspace.value = leave
        const ui = await loadComposable()

        expect(ui.permissions.value.canAccessWorkspaceMenu).toBe(leave)
      }
    )
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

      const denied = await loadComposable()
      expect(denied.canReactivatePlan.value).toBe(false)

      mockCanReactivate.value = true
      const allowed = await loadComposable()
      expect(allowed.canReactivatePlan.value).toBe(true)
    })

    it('falls back to can_manage_subscription on the legacy rail', async () => {
      mockShouldUseWorkspaceBilling.value = false
      mockCanManageSubscription.value = true

      const ui = await loadComposable()
      expect(ui.permissions.value.canManageSubscriptionLifecycle).toBe(true)
      expect(ui.canReactivatePlan.value).toBe(true)
    })

    it('falls back to can_manage_subscription off Cloud', async () => {
      mockIsCloud.value = false
      mockShouldUseWorkspaceBilling.value = true
      mockCanManageSubscription.value = true

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
      useBillingCapabilities().canSubscribeSelfServe = computed(() => false)

      const ui = await loadComposable()
      expect(ui.canOpenPricingSurface.value).toBe(false)
    })

    it('opens the catalog when the server allows self-serve subscribing', async () => {
      mockShouldUseWorkspaceBilling.value = true

      const ui = await loadComposable()
      expect(ui.canOpenPricingSurface.value).toBe(true)
    })

    it('falls back to can_manage_subscription on the legacy rail', async () => {
      mockShouldUseWorkspaceBilling.value = false
      mockCanManageSubscription.value = true
      useBillingCapabilities().canSubscribeSelfServe = computed(() => false)

      const ui = await loadComposable()
      expect(ui.permissions.value.canManageSubscription).toBe(true)
      expect(ui.canOpenPricingSurface.value).toBe(true)
    })

    it('falls back to can_manage_subscription off Cloud', async () => {
      mockIsCloud.value = false
      mockShouldUseWorkspaceBilling.value = true
      mockCanManageSubscription.value = true
      useBillingCapabilities().canSubscribeSelfServe = computed(() => false)

      const ui = await loadComposable()
      expect(ui.canOpenPricingSurface.value).toBe(true)
    })

    it('falls back to can_manage_subscription when the snapshot is not authoritative', async () => {
      mockCanManageSubscription.value = true
      useBillingCapabilities().snapshotAuthoritative = computed(() => false)
      useBillingCapabilities().canSubscribeSelfServe = computed(() => false)

      const ui = await loadComposable()
      expect(ui.canOpenPricingSurface.value).toBe(true)
    })

    it('keeps the catalog closed when can_manage_subscription is withheld and no snapshot is readable', async () => {
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspace: teamMemberWorkspace
      })
      useBillingCapabilities().snapshotAuthoritative = computed(() => false)
      useBillingCapabilities().canSubscribeSelfServe = computed(() => false)

      const ui = await loadComposable()
      expect(ui.permissions.value.canManageSubscription).toBe(false)
      expect(ui.canOpenPricingSurface.value).toBe(false)
    })
  })
})

vi.mock(import('firebase/auth'), { spy: true })
