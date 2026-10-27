import { computed, watch } from 'vue'
import { createSharedComposable } from '@vueuse/core'

import { useFeatureFlags } from '@/composables/useFeatureFlags'

import type {
  WorkspaceRole,
  WorkspaceType
} from '@/platform/workspace/api/workspaceApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

interface WorkspacePermissions {
  canViewOtherMembers: boolean
  canViewPendingInvites: boolean
}

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

function useWorkspaceUIInternal() {
  const store = useTeamWorkspaceStore()
  const { flags } = useFeatureFlags()

  const isInPersonalWorkspace = computed(() => store.isInPersonalWorkspace)

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

  const permissions = computed<WorkspacePermissions>(() => ({
    canViewOtherMembers: uiConfig.value.showMembersList,
    canViewPendingInvites: uiConfig.value.showPendingTab
  }))

  const isWorkspaceMenuInHeader = computed(
    () => flags.unifiedBillingSettingsEnabled
  )

  return {
    permissions,
    uiConfig,
    workspaceType,
    workspaceRole,
    isInPersonalWorkspace,
    isWorkspaceMenuInHeader
  }
}

export const useWorkspaceUI = createSharedComposable(useWorkspaceUIInternal)
