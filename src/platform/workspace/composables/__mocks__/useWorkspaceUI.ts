import { onTestFinished, vi } from 'vitest'
import { computed } from 'vue'

import type { useWorkspaceUI as realUseWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'

function defaults(): ReturnType<typeof realUseWorkspaceUI> {
  return {
    permissions: computed(() => ({
      canViewOtherMembers: false,
      canViewPendingInvites: false,
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
      workspaceMenuAction: null,
      workspaceMenuDisabledTooltip: null
    })),
    workspaceType: computed(() => 'personal'),
    workspaceRole: computed(() => 'owner'),
    isInPersonalWorkspace: computed(() => true),
    isWorkspaceSubscribed: computed(() => false),
    canAccessSubscriptionFeatures: computed(() => false),
    isSubscriptionCancelled: computed(() => false),
    isTeamPlanCancelled: computed(() => false),
    isWorkspaceMenuInHeader: computed(() => false)
  }
}

const workspaceUI = defaults()

export const useWorkspaceUI = vi.fn(() => {
  onTestFinished(() => {
    Object.assign(workspaceUI, defaults())
  })
  return workspaceUI
})
