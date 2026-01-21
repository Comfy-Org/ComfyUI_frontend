import { computed, ref } from 'vue'
import { createSharedComposable } from '@vueuse/core'

import type { WorkspaceRole, WorkspaceType } from '../api/workspaceApi'
import { useTeamWorkspaceStore } from '../stores/teamWorkspaceStore'

/** Permission flags for workspace actions */
interface WorkspacePermissions {
  canLeaveWorkspace: boolean
  canAccessWorkspaceMenu: boolean
  canManageSubscription: boolean
}

/** UI configuration for workspace role */
interface WorkspaceUIConfig {
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
      canLeaveWorkspace: false,
      canAccessWorkspaceMenu: false,
      canManageSubscription: true
    }
  }

  if (role === 'owner') {
    return {
      canLeaveWorkspace: true,
      canAccessWorkspaceMenu: true,
      canManageSubscription: true
    }
  }

  // member role
  return {
    canLeaveWorkspace: true,
    canAccessWorkspaceMenu: true,
    canManageSubscription: false
  }
}

function getUIConfig(
  type: WorkspaceType,
  role: WorkspaceRole
): WorkspaceUIConfig {
  if (type === 'personal') {
    return {
      showEditWorkspaceMenuItem: false,
      workspaceMenuAction: null,
      workspaceMenuDisabledTooltip: null
    }
  }

  if (role === 'owner') {
    return {
      showEditWorkspaceMenuItem: true,
      workspaceMenuAction: 'delete',
      workspaceMenuDisabledTooltip:
        'workspacePanel.menu.deleteWorkspaceDisabledTooltip'
    }
  }

  // member role
  return {
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

  // Tab management (shared UI state)
  const activeTab = ref<string>('plan')

  function setActiveTab(tab: string | number) {
    activeTab.value = String(tab)
  }

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

  return {
    // Tab management
    activeTab: computed(() => activeTab.value),
    setActiveTab,

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
