import { onTestFinished, vi } from 'vitest'
import { computed } from 'vue'

import type { useAccountUI as realUseAccountUI } from '@/platform/account/composables/useAccountUI'
import { receiveServerFact } from '@/platform/serverFacts/serverFact'

function defaults(): ReturnType<typeof realUseAccountUI> {
  return {
    permissions: computed(() => ({
      canViewOtherMembers: false,
      canViewPendingInvites: false,
      canManageSubscription: receiveServerFact('can_manage_subscription', true),
      canManageSubscriptionLifecycle: receiveServerFact(
        'can_manage_subscription',
        true
      ),
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

const accountUI = defaults()

export const useAccountUI = vi.fn(() => {
  onTestFinished(() => {
    Object.assign(accountUI, defaults())
  })
  return accountUI
})
