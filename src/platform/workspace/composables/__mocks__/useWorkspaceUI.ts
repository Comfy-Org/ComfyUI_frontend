import { onTestFinished, vi } from 'vitest'
import { computed } from 'vue'

import type { useWorkspaceUI as realUseWorkspaceUI } from '../useWorkspaceUI'

function defaults(): ReturnType<typeof realUseWorkspaceUI> {
  return {
    permissions: computed(() => ({
      canViewOtherMembers: false,
      canViewPendingInvites: false,
      canLeaveWorkspace: false,
      canAccessWorkspaceMenu: false,
      canManageSubscription: true,
      canManageSubscriptionLifecycle: true,
      canDowngradeToPersonal: false
    })),
    canReactivatePlan: computed(() => true),
    canOpenPricingSurface: computed(() => true),
    uiConfig: computed(() => ({
      showMembersList: false,
      showPendingTab: false,
      showSearch: false,
      showRoleColumn: false,
      showCreditsColumn: false,
      membersGridCols: 'grid-cols-1',
      pendingGridCols: 'grid-cols-[50%_20%_20%_10%]',
      headerGridCols: 'grid-cols-1',
      showEditWorkspaceMenuItem: true,
      workspaceMenuAction: null,
      workspaceMenuDisabledTooltip: null
    })),
    workspaceType: computed(() => 'personal'),
    workspaceRole: computed(() => 'owner'),
    isInPersonalWorkspace: computed(() => true),
    isWorkspaceSubscribed: computed(() => false),
    canAccessSubscriptionFeatures: computed(() => false),
    isOriginalOwner: computed(() => true),
    isSubscriptionCancelled: computed(() => false),
    isTeamPlanCancelled: computed(() => false),
    isDeleteDisabled: computed(() => false),
    deleteDisabledTooltipKey: computed(() => null)
  }
}

const workspaceUI = defaults()

export const useWorkspaceUI = vi.fn(() => {
  onTestFinished(() => {
    Object.assign(workspaceUI, defaults())
  })
  return workspaceUI
})
