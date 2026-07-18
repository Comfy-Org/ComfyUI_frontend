import { computed, watch } from 'vue'
import { createSharedComposable } from '@vueuse/core'

import { useBillingContext } from '@/composables/billing/useBillingContext'

import type { WorkspaceRole, WorkspaceType } from '../api/workspaceApi'
import { useTeamWorkspaceStore } from '../stores/teamWorkspaceStore'

/** Permission flags for workspace actions */
interface WorkspacePermissions {
  canViewOtherMembers: boolean
  canViewPendingInvites: boolean
  canInviteMembers: boolean
  canManageInvites: boolean
  canManageMembers: boolean
  canLeaveWorkspace: boolean
  canAccessWorkspaceMenu: boolean
  canManageSubscription: boolean
  canManageSubscriptionLifecycle: boolean
  canDowngradeToPersonal: boolean
  canTopUp: boolean
}

/** UI configuration for workspace role */
interface WorkspaceUIConfig {
  showMembersList: boolean
  showPendingTab: boolean
  showSearch: boolean
  showRoleColumn: boolean
  membersGridCols: string
  pendingGridCols: string
  headerGridCols: string
  showEditWorkspaceMenuItem: boolean
  workspaceMenuAction: 'leave' | 'delete' | null
  workspaceMenuDisabledTooltip: string | null
}

function getPermissions(
  type: WorkspaceType,
  role: WorkspaceRole,
  isOriginalOwner: boolean,
  hasActiveWorkspace: boolean
): WorkspacePermissions {
  const canManageBilling = hasActiveWorkspace && role === 'owner'
  const billingPermissions = {
    canManageSubscription: canManageBilling,
    canManageSubscriptionLifecycle: canManageBilling,
    canDowngradeToPersonal: canManageBilling && isOriginalOwner,
    canTopUp: canManageBilling
  }

  if (type === 'personal') {
    return {
      canViewOtherMembers: false,
      canViewPendingInvites: false,
      canInviteMembers: false,
      canManageInvites: false,
      canManageMembers: false,
      canLeaveWorkspace: false,
      canAccessWorkspaceMenu: false,
      ...billingPermissions
    }
  }

  if (role === 'owner') {
    return {
      canViewOtherMembers: true,
      canViewPendingInvites: true,
      canInviteMembers: true,
      canManageInvites: true,
      canManageMembers: true,
      canLeaveWorkspace: true,
      canAccessWorkspaceMenu: true,
      ...billingPermissions
    }
  }

  // member role
  return {
    canViewOtherMembers: true,
    canViewPendingInvites: false,
    canInviteMembers: false,
    canManageInvites: false,
    canManageMembers: false,
    canLeaveWorkspace: true,
    canAccessWorkspaceMenu: true,
    ...billingPermissions
  }
}

function getUIConfig(
  type: WorkspaceType,
  role: WorkspaceRole
): WorkspaceUIConfig {
  if (type === 'personal') {
    return {
      showMembersList: false,
      showPendingTab: false,
      showSearch: false,
      showRoleColumn: false,
      membersGridCols: 'grid-cols-1',
      pendingGridCols: 'grid-cols-[50%_20%_20%_10%]',
      headerGridCols: 'grid-cols-1',
      showEditWorkspaceMenuItem: true,
      workspaceMenuAction: null,
      workspaceMenuDisabledTooltip: null
    }
  }

  if (role === 'owner') {
    return {
      showMembersList: true,
      showPendingTab: true,
      showSearch: true,
      showRoleColumn: true,
      membersGridCols: 'grid-cols-[50%_40%_10%]',
      pendingGridCols: 'grid-cols-[50%_20%_20%_10%]',
      headerGridCols: 'grid-cols-[50%_40%_10%]',
      showEditWorkspaceMenuItem: true,
      workspaceMenuAction: 'delete',
      workspaceMenuDisabledTooltip:
        'workspacePanel.menu.deleteWorkspaceDisabledTooltip'
    }
  }

  // member role
  return {
    showMembersList: true,
    showPendingTab: false,
    showSearch: true,
    showRoleColumn: true,
    membersGridCols: 'grid-cols-[1fr_auto]',
    pendingGridCols: 'grid-cols-[50%_20%_20%_10%]',
    headerGridCols: 'grid-cols-[1fr_auto]',
    showEditWorkspaceMenuItem: false,
    workspaceMenuAction: 'leave',
    workspaceMenuDisabledTooltip: null
  }
}

/**
 * Internal implementation of UI configuration composable.
 */
function useWorkspaceUIInternal() {
  const store = useTeamWorkspaceStore()
  const { isActiveSubscription, isTeamPlan, subscription } = useBillingContext()

  const isInPersonalWorkspace = computed(() => store.isInPersonalWorkspace)
  const isWorkspaceSubscribed = computed(() => store.isWorkspaceSubscribed)

  const workspaceType = computed<WorkspaceType>(
    () => store.activeWorkspace?.type ?? 'personal'
  )

  const workspaceRole = computed<WorkspaceRole>(
    () => store.activeWorkspace?.role ?? 'owner'
  )

  watch(
    [() => store.activeWorkspace?.id, () => store.activeWorkspace?.role],
    () => {
      if (store.activeWorkspace?.role === 'owner') {
        void store.ensureMembersLoaded()
      }
    },
    { immediate: true }
  )

  const permissions = computed<WorkspacePermissions>(() =>
    getPermissions(
      workspaceType.value,
      workspaceRole.value,
      store.isCurrentUserOriginalOwner,
      store.activeWorkspace !== null
    )
  )

  const uiConfig = computed<WorkspaceUIConfig>(() =>
    getUIConfig(workspaceType.value, workspaceRole.value)
  )

  const isOriginalOwner = computed(() => store.isCurrentUserOriginalOwner)

  const isSubscriptionCancelled = computed(
    () => subscription.value?.isCancelled ?? false
  )

  const isTeamPlanCancelled = computed(
    () => isTeamPlan.value && isSubscriptionCancelled.value
  )

  // A workspace can't be deleted while its subscription is active and not yet
  // cancelled — the owner must cancel first. Both settings panels read this so
  // their menus can't desync on a billing-flag change.
  const isDeleteDisabled = computed(
    () =>
      isActiveSubscription.value && !(subscription.value?.isCancelled ?? false)
  )

  const deleteDisabledTooltipKey = computed(() =>
    isDeleteDisabled.value ? uiConfig.value.workspaceMenuDisabledTooltip : null
  )

  return {
    // Permissions and config
    permissions,
    uiConfig,
    workspaceType,
    workspaceRole,
    isInPersonalWorkspace,
    isWorkspaceSubscribed,
    isActiveSubscription,
    isOriginalOwner,
    isSubscriptionCancelled,
    isTeamPlanCancelled,
    isDeleteDisabled,
    deleteDisabledTooltipKey
  }
}

/**
 * UI configuration composable derived from workspace state.
 * Controls what UI elements are visible/enabled based on role and workspace type.
 * Uses createSharedComposable to ensure tab state is shared across components.
 */
export const useWorkspaceUI = createSharedComposable(useWorkspaceUIInternal)
