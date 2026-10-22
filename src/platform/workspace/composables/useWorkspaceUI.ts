import { computed, watch } from 'vue'
import { createSharedComposable } from '@vueuse/core'

import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useBillingRouting } from '@/platform/billing/composables/useBillingRouting'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'

import type {
  WorkspaceRole,
  WorkspaceType
} from '@/platform/workspace/api/workspaceApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

type BillingCapabilities = ReturnType<typeof useBillingCapabilities>

interface ServedPermissionFacts {
  canManageSubscription: BillingCapabilities['canManageSubscription']['value']
  canDowngradeToPersonal: BillingCapabilities['canDowngradeToPersonal']['value']
}

/** Permission flags for workspace actions */
interface WorkspacePermissions {
  canViewOtherMembers: boolean
  canViewPendingInvites: boolean
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
  workspaceMenuAction: 'delete' | null
  workspaceMenuDisabledTooltip: string | null
}

function getPermissions(
  type: WorkspaceType,
  role: WorkspaceRole,
  { canManageSubscription, canDowngradeToPersonal }: ServedPermissionFacts
): WorkspacePermissions {
  const billingPermissions = {
    canManageSubscription,
    canManageSubscriptionLifecycle: canManageSubscription,
    canDowngradeToPersonal
  }

  if (role === 'member') {
    return {
      canViewOtherMembers: true,
      canViewPendingInvites: false,
      ...billingPermissions
    }
  }

  if (type === 'personal') {
    return {
      canViewOtherMembers: false,
      canViewPendingInvites: false,
      ...billingPermissions
    }
  }

  return {
    canViewOtherMembers: true,
    canViewPendingInvites: true,
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
  const { canAccessSubscriptionFeatures, isTeamPlan, subscription } =
    useBillingContext()
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
  const {
    canReactivate,
    canSubscribeSelfServe,
    snapshotAuthoritative,
    canManageSubscription,
    canDowngradeToPersonal
  } = useBillingCapabilities()

  const permissions = computed<WorkspacePermissions>(() =>
    getPermissions(workspaceType.value, workspaceRole.value, {
      canManageSubscription: canManageSubscription.value,
      canDowngradeToPersonal: canDowngradeToPersonal.value
    })
  )

  const canReactivatePlan = computed(() =>
    isCloud && shouldUseWorkspaceBilling.value
      ? canReactivate.value
      : permissions.value.canManageSubscriptionLifecycle
  )

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
      flags.memberCreditLimitsEnabled &&
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

  const isSubscriptionCancelled = computed(
    () => subscription.value?.isCancelled ?? false
  )

  const isTeamPlanCancelled = computed(
    () => isTeamPlan.value && isSubscriptionCancelled.value
  )

  const isWorkspaceMenuInHeader = computed(
    () => flags.unifiedBillingSettingsEnabled
  )

  return {
    permissions,
    canReactivatePlan,
    canOpenPricingSurface,
    uiConfig,
    workspaceType,
    workspaceRole,
    isInPersonalWorkspace,
    isWorkspaceSubscribed,
    canAccessSubscriptionFeatures,
    isSubscriptionCancelled,
    isTeamPlanCancelled,
    isWorkspaceMenuInHeader
  }
}

/**
 * UI configuration composable derived from workspace state.
 * Controls what UI elements are visible/enabled based on role and workspace type.
 * Uses createSharedComposable to ensure tab state is shared across components.
 */
export const useWorkspaceUI = createSharedComposable(useWorkspaceUIInternal)
