import { storeToRefs } from 'pinia'

import { useWorkspaceAuthStore } from '@/stores/workspaceAuthStore'

export { WORKSPACE_STORAGE_KEYS } from './workspaceConstants'
export { WorkspaceAuthError } from '@/stores/workspaceAuthStore'

export function useWorkspaceAuth() {
  const store = useWorkspaceAuthStore()
  const {
    currentWorkspace,
    workspaceToken,
    isLoading,
    error,
    isAuthenticated
  } = storeToRefs(store)

  return {
    currentWorkspace,
    workspaceToken,
    isLoading,
    error,
    isAuthenticated,
    initializeFromSession: store.initializeFromSession,
    switchWorkspace: store.switchWorkspace,
    refreshToken: store.refreshToken,
    getWorkspaceAuthHeader: store.getWorkspaceAuthHeader,
    clearWorkspaceContext: store.clearWorkspaceContext
  }
}
