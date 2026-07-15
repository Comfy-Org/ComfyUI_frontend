import { computed, watch } from 'vue'
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
  canManageMembers: boolean
  canLeaveWorkspace: boolean
  canAccessWorkspaceMenu: boolean
  canManageSubscription: boolean
  // Creator-only subscription lifecycle: cancel / reactivate / downgrade.
  // Any owner has `canManageSubscription` (manage payment, top-up, change
  // commit); only the original owner gets `canManageSubscriptionLifecycle`.
  canManageSubscriptionLifecycle: boolean
  canTopUp: boolean
  // Partner-node governance is workspace-wide and gated to owners
  // (both hold the backend 'owner' role); Members never see the tab.
  canManagePartnerNodes: boolean
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
      canManageMembers: false,
      canLeaveWorkspace: false,
      canAccessWorkspaceMenu: false,
      canManageSubscription: true,
      // Personal workspace is single-member: the user is the sole owner/creator.
      canManageSubscriptionLifecycle: true,
      canTopUp: true,
      canManagePartnerNodes: false
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
      canManageSubscription: true,
      canManageSubscriptionLifecycle: isOriginalOwner,
      canTopUp: true,
      canManagePartnerNodes: true
    }
  }

  // member role
  return {
    canViewOtherMembers: true,
    // Members can see who's been invited (view-only); they still can't
    // resend/revoke (canManageInvites) or invite (canInviteMembers).
    canViewPendingInvites: true,
    canInviteMembers: false,
    canManageInvites: false,
    canManageMembers: false,
    canLeaveWorkspace: true,
    canAccessWorkspaceMenu: true,
    canManageSubscription: false,
    canManageSubscriptionLifecycle: false,
    canTopUp: false,
    canManagePartnerNodes: false
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
    showPendingTab: true,
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
