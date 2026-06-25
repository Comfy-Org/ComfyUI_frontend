import { computed } from 'vue'
import { createSharedComposable } from '@vueuse/core'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useBillingContext } from '@/composables/billing/useBillingContext'

import type { WorkspaceRole, WorkspaceType } from '../api/workspaceApi'
import type { WorkspaceMember } from '../stores/teamWorkspaceStore'
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
  canTopUp: boolean
}

/** UI configuration for workspace role */
interface WorkspaceUIConfig {
  showMembersList: boolean
  showPendingTab: boolean
  showSearch: boolean
  showDateColumn: boolean
  showRoleBadge: boolean
  membersGridCols: string
  pendingGridCols: string
  headerGridCols: string
  showEditWorkspaceMenuItem: boolean
  workspaceMenuAction: 'leave' | 'delete' | null
  workspaceMenuDisabledTooltip: string | null
}

function getPermissions(
  type: WorkspaceType,
  role: WorkspaceRole
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
      showDateColumn: false,
      showRoleBadge: false,
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
      showDateColumn: true,
      showRoleBadge: true,
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
    showDateColumn: true,
    showRoleBadge: true,
    membersGridCols: 'grid-cols-[1fr_auto]',
    pendingGridCols: 'grid-cols-[50%_20%_20%_10%]',
    headerGridCols: 'grid-cols-[1fr_auto]',
    showEditWorkspaceMenuItem: false,
    workspaceMenuAction: 'leave',
    workspaceMenuDisabledTooltip: null
  }
}

/**
 * The original owner is the earliest-joined member. Ties on join date are
 * broken by the stable member id so exactly one member is the original owner.
 */
function isOriginalOwnerByEmail(
  members: WorkspaceMember[],
  email: string
): boolean {
  if (members.length === 0) return false
  const original = [...members].sort(
    (a, b) =>
      a.joinDate.getTime() - b.joinDate.getTime() || a.id.localeCompare(b.id)
  )[0]
  return original.email.toLowerCase() === email
}

/**
 * Internal implementation of UI configuration composable.
 */
function useWorkspaceUIInternal() {
  const store = useTeamWorkspaceStore()
  const { userEmail } = useCurrentUser()
  const { isActiveSubscription, subscription } = useBillingContext()

  const isInPersonalWorkspace = computed(() => store.isInPersonalWorkspace)
  const isWorkspaceSubscribed = computed(() => store.isWorkspaceSubscribed)
  const members = computed(() => store.members)

  const workspaceType = computed<WorkspaceType>(
    () => store.activeWorkspace?.type ?? 'personal'
  )

  const workspaceRole = computed<WorkspaceRole>(
    () => store.activeWorkspace?.role ?? 'owner'
  )

  const permissions = computed<WorkspacePermissions>(() =>
    getPermissions(workspaceType.value, workspaceRole.value)
  )

  const uiConfig = computed<WorkspaceUIConfig>(() =>
    getUIConfig(workspaceType.value, workspaceRole.value)
  )

  // Cancel / reactivate / delete are original-owner-only; personal workspaces
  // are single-member, so the user is always their own original owner.
  const isOriginalOwner = computed(() => {
    if (isInPersonalWorkspace.value) return true
    const email = userEmail.value?.toLowerCase()
    return !!email && isOriginalOwnerByEmail(members.value, email)
  })

  // Cancellation is meaningful only for team (workspace) billing; personal plans
  // use legacy billing with different semantics.
  const isTeamPlanCancelled = computed(
    () =>
      !isInPersonalWorkspace.value && (subscription.value?.isCancelled ?? false)
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
