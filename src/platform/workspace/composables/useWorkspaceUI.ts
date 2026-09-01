import { computed, watch } from 'vue'
import { createSharedComposable } from '@vueuse/core'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useBillingRouting } from '@/composables/billing/useBillingRouting'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'

import type { WorkspaceRole, WorkspaceType } from '../api/workspaceApi'
import { useTeamWorkspaceStore } from '../stores/teamWorkspaceStore'

/** Permission flags for workspace actions */
interface WorkspacePermissions {
  canViewOtherMembers: boolean
  canViewPendingInvites: boolean
  canLeaveWorkspace: boolean
  canAccessWorkspaceMenu: boolean
  canManageSubscription: boolean
  canManageSubscriptionLifecycle: boolean
  canDowngradeToPersonal: boolean
}

/** UI configuration for workspace role */
interface WorkspaceUIConfig {
  showMembersList: boolean
  showPendingTab: boolean
  showSearch: boolean
  showRoleColumn: boolean
  showCreditsColumn: boolean
  membersGridCols: string
  pendingGridCols: string
  headerGridCols: string
  showEditWorkspaceMenuItem: boolean
  workspaceMenuAction: 'delete' | null
  workspaceMenuDisabledTooltip: string | null
}

function getPermissions(
  type: WorkspaceType,
  role: WorkspaceRole,
  isOriginalOwner: boolean,
  isOriginalOwnerResolved: boolean,
  hasActiveWorkspace: boolean,
  isTeamPlan: boolean
): WorkspacePermissions {
  const canManageBilling = hasActiveWorkspace && role === 'owner'
  const canLeaveWorkspace =
    hasActiveWorkspace &&
    (type === 'personal'
      ? isTeamPlan &&
        !isOriginalOwner &&
        (role === 'member' || isOriginalOwnerResolved)
      : true)
  const billingPermissions = {
    canManageSubscription: canManageBilling,
    canManageSubscriptionLifecycle: canManageBilling,
    canDowngradeToPersonal: canManageBilling && isTeamPlan && isOriginalOwner
  }

  if (role === 'member') {
    return {
      canViewOtherMembers: true,
      canViewPendingInvites: false,
      canLeaveWorkspace,
      canAccessWorkspaceMenu: canLeaveWorkspace,
      ...billingPermissions
    }
  }

  if (type === 'personal') {
    return {
      canViewOtherMembers: false,
      canViewPendingInvites: false,
      canLeaveWorkspace,
      canAccessWorkspaceMenu: canLeaveWorkspace,
      ...billingPermissions
    }
  }

  return {
    canViewOtherMembers: true,
    canViewPendingInvites: true,
    canLeaveWorkspace,
    canAccessWorkspaceMenu: true,
    ...billingPermissions
  }
}

function getUIConfig(
  type: WorkspaceType,
  role: WorkspaceRole
): WorkspaceUIConfig {
  if (role === 'member') {
    return {
      showMembersList: true,
      showPendingTab: false,
      showSearch: true,
      showRoleColumn: true,
      showCreditsColumn: false,
      membersGridCols: 'grid-cols-[1fr_auto]',
      pendingGridCols: 'grid-cols-[50%_20%_20%_10%]',
      headerGridCols: 'grid-cols-[1fr_auto]',
      showEditWorkspaceMenuItem: false,
      workspaceMenuAction: null,
      workspaceMenuDisabledTooltip: null
    }
  }

  if (type === 'personal') {
    return {
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
    }
  }

  return {
    showMembersList: true,
    showPendingTab: true,
    showSearch: true,
    showRoleColumn: true,
    showCreditsColumn: false,
    membersGridCols: 'grid-cols-[50%_40%_10%]',
    pendingGridCols: 'grid-cols-[50%_20%_20%_10%]',
    headerGridCols: 'grid-cols-[50%_40%_10%]',
    showEditWorkspaceMenuItem: true,
    workspaceMenuAction: 'delete',
    workspaceMenuDisabledTooltip:
      'workspacePanel.menu.deleteWorkspaceDisabledTooltip'
  }
}

/**
 * Internal implementation of UI configuration composable.
 */
function useWorkspaceUIInternal() {
  const store = useTeamWorkspaceStore()
  const { isActiveSubscription, isTeamPlan, subscription } = useBillingContext()
  const { flags } = useFeatureFlags()

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

  const { shouldUseWorkspaceBilling } = useBillingRouting()
  const { canReactivate, canSubscribeSelfServe, snapshotAuthoritative } =
    useBillingCapabilities()

  const permissions = computed<WorkspacePermissions>(() =>
    getPermissions(
      workspaceType.value,
      workspaceRole.value,
      store.isCurrentUserOriginalOwner,
      store.originalOwnerId !== null,
      store.activeWorkspace !== null,
      isTeamPlan.value
    )
  )

  // legacy_stripe workspaces have no capability projection row, so the
  // server-resolved can_reactivate is false for them and cannot gate the
  // action; that rail stays on the membership check.
  //
  // Every reactivation surface reads this — the affordances and the handlers
  // that execute them. They must not diverge: an affordance shown on a
  // condition the handler does not share offers an action that silently fails,
  // and the reverse hides a working one.
  const canReactivatePlan = computed(() =>
    isCloud && shouldUseWorkspaceBilling.value
      ? canReactivate.value
      : permissions.value.canManageSubscriptionLifecycle
  )

  // Whether the self-serve pricing catalog applies to this workspace at all.
  // The server resolves can_subscribe_self_serve false for sales-managed tiers
  // (Enterprise, unrecognized), so every pricing-table entry point — menu
  // items, settings links, and the ?pricing= deep link — reads this one value.
  // Same rail split as canReactivatePlan: legacy_stripe has no capability
  // projection row and stays on the membership check.
  //
  // Opening the catalog is navigation, not a billing write — every checkout
  // endpoint enforces its own policy — so an absent snapshot falls back to
  // membership rather than stranding a self-serve owner with no route to a
  // plan. This mirrors canTopUp, which already fails open for owners.
  const canOpenPricingSurface = computed(() => {
    if (!isCloud || !shouldUseWorkspaceBilling.value)
      return permissions.value.canManageSubscription
    return snapshotAuthoritative.value
      ? canSubscribeSelfServe.value
      : permissions.value.canManageSubscription
  })

  const uiConfig = computed<WorkspaceUIConfig>(() => {
    const base = getUIConfig(workspaceType.value, workspaceRole.value)
    const showCreditsColumn =
      flags.billingControlEnabled &&
      workspaceType.value === 'team' &&
      workspaceRole.value === 'owner'
    if (!showCreditsColumn) return base

    return {
      ...base,
      showCreditsColumn: true,
      membersGridCols: 'grid-cols-[38%_18%_30%_14%]',
      headerGridCols: 'grid-cols-[38%_18%_30%_14%]'
    }
  })

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
    canReactivatePlan,
    canOpenPricingSurface,
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
