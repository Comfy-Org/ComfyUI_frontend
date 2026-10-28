import { whenever } from '@vueuse/core'
import { reportError } from '@comfyorg/telemetry/reportError'
import { watch } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { isCloud } from '@/platform/distribution/types'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import {
  completeWorkflowLogoutTransition,
  getStorageIdentity,
  prepareWorkflowLogoutTransition,
  setStorageIdentity,
  setStorageWorkspaceId
} from '@/platform/workflow/persistence/base/storageIO'

export function useStorageScopeLifecycle(): void {
  const { resolvedUserInfo, isApiKeyLogin } = useCurrentUser()
  const teamWorkspaceStore = useTeamWorkspaceStore()
  let stopWorkspaceReadinessWatcher: (() => void) | undefined
  let workspaceInitializationPending = false

  function stopPendingWorkspaceReadinessWatcher(): void {
    stopWorkspaceReadinessWatcher?.()
    stopWorkspaceReadinessWatcher = undefined
  }

  function isWorkspaceInitConcluded(): boolean {
    return (
      (teamWorkspaceStore.initState === 'ready' &&
        teamWorkspaceStore.activeWorkspaceId !== null) ||
      teamWorkspaceStore.initState === 'error'
    )
  }

  function syncResolvedWorkspace(): void {
    setStorageWorkspaceId(
      teamWorkspaceStore.initState === 'ready'
        ? teamWorkspaceStore.activeWorkspaceId
        : null
    )
  }

  function releaseIdentityFenceWhenReady(): void {
    if (isWorkspaceInitConcluded()) {
      syncResolvedWorkspace()
      completeWorkflowLogoutTransition()
      return
    }
    stopWorkspaceReadinessWatcher = whenever(
      isWorkspaceInitConcluded,
      () => {
        stopWorkspaceReadinessWatcher = undefined
        syncResolvedWorkspace()
        completeWorkflowLogoutTransition()
      },
      { once: true }
    )
  }

  function initializeWorkspaceAfterIdentityChange(): void {
    if (!workspaceInitializationPending) return
    workspaceInitializationPending = false
    void teamWorkspaceStore.initialize().catch((error: unknown) => {
      reportError(error, {
        surface: 'auth',
        errorType: 'workspace_auth_gate_initialization_failure'
      })
    })
  }

  function prepareWorkspaceForIdentity(isIdentityReplacement: boolean): void {
    if (isIdentityReplacement) {
      teamWorkspaceStore.resetForIdentityChange()
      workspaceInitializationPending = true
      return
    }
    if (
      isApiKeyLogin.value &&
      teamWorkspaceStore.initState === 'uninitialized'
    ) {
      workspaceInitializationPending = true
    }
  }

  watch(
    resolvedUserInfo,
    (user) => {
      const nextIdentity = user?.id ?? null
      if (nextIdentity === getStorageIdentity()) return

      stopPendingWorkspaceReadinessWatcher()
      if (isCloud) prepareWorkflowLogoutTransition()
      const isIdentityReplacement = isCloud && getStorageIdentity() !== null
      prepareWorkspaceForIdentity(isIdentityReplacement)
      setStorageIdentity(nextIdentity)
      setStorageWorkspaceId(null)

      if (!isCloud || nextIdentity === null) return
      initializeWorkspaceAfterIdentityChange()
      releaseIdentityFenceWhenReady()
    },
    { immediate: true, flush: 'sync' }
  )

  watch(
    [
      () => teamWorkspaceStore.initState,
      () => teamWorkspaceStore.activeWorkspaceId
    ],
    () => syncResolvedWorkspace(),
    { immediate: true, flush: 'sync' }
  )
}
