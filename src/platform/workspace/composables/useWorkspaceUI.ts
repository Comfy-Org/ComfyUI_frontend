import { computed, watch } from 'vue'
import { createSharedComposable } from '@vueuse/core'

import type { WorkspaceRole, WorkspaceType } from '../api/workspaceApi'
import { useTeamWorkspaceStore } from '../stores/teamWorkspaceStore'

/** Permission flags for workspace actions */
interface WorkspacePermissions {
  canViewOtherMembers: boolean
  canViewPendingInvites: boolean
  canInviteMembers: boolean
  canManageInvites: boolean
  canRemoveMembers: boolean
  canLeaveWorkspace: boolean
  canAccessWorkspaceMenu: boolean
  canManageSubscription: boolean
  // Creator-only subscription lifecycle: cancel / reactivate / downgrade.
  // Any owner has `canManageSubscription` (manage payment, top-up, change
  // commit); only the original owner gets `canManageSubscriptionLifecycle`.
  canManageSubscriptionLifecycle: boolean
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
  isOriginalOwner: boolean
): WorkspacePermissions {
  if (type === 'personal') {
    return {
      canViewOtherMembers: false,
      canViewPendingInvites: false,
      canInviteMembers: false,
      canManageInvites: false,
      canRemoveMembers: false,
      canLeaveWorkspace: false,
      canAccessWorkspaceMenu: false,
      canManageSubscription: true,
      // Personal workspace is single-member: the user is the sole owner/creator.
      canManageSubscriptionLifecycle: true,
      canTopUp: true
    }
  }

  if (role === 'owner') {
    return {
      canViewOtherMembers: true,
      canViewPendingInvites: true,
      canInviteMembers: true,
      canManageInvites: true,
      canRemoveMembers: true,
      canLeaveWorkspace: true,
      canAccessWorkspaceMenu: true,
      canManageSubscription: true,
      canManageSubscriptionLifecycle: isOriginalOwner,
      canTopUp: true
    }
  }

  // member role
  return {
    canViewOtherMembers: true,
    canViewPendingInvites: false,
    canInviteMembers: false,
    canManageInvites: false,
    canRemoveMembers: false,
    canLeaveWorkspace: true,
    canAccessWorkspaceMenu: true,
    canManageSubscription: false,
    canManageSubscriptionLifecycle: false,
    canTopUp: false
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
      showEditWorkspaceMenuItem: false,
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

  const workspaceType = computed<WorkspaceType>(
    () => store.activeWorkspace?.type ?? 'personal'
  )

  const workspaceRole = computed<WorkspaceRole>(
    () => store.activeWorkspace?.role ?? 'owner'
  )

  // The original-owner signal lives on the members-list self-row, so a team
  // workspace's members must be loaded before its lifecycle gate can resolve.
  // The store dedupes in-flight/already-loaded requests and logs failures;
  // until members arrive the getter fails closed.
  watch(
    () => store.activeWorkspace?.id,
    () => {
      if (store.activeWorkspace?.type === 'team') {
        void store.ensureMembersLoaded()
      }
    },
    { immediate: true }
  )

  const permissions = computed<WorkspacePermissions>(() =>
    getPermissions(
      workspaceType.value,
      workspaceRole.value,
      store.isCurrentUserOriginalOwner
    )
  )

  const uiConfig = computed<WorkspaceUIConfig>(() =>
    getUIConfig(workspaceType.value, workspaceRole.value)
  )

  return {
    // Permissions and config
    permissions,
    uiConfig,
    workspaceType,
    workspaceRole
  }
}

/**
 * UI configuration composable derived from workspace state.
 * Controls what UI elements are visible/enabled based on role and workspace type.
 * Uses createSharedComposable to ensure tab state is shared across components.
 */
export const useWorkspaceUI = createSharedComposable(useWorkspaceUIInternal)
