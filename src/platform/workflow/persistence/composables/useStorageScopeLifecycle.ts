import { whenever } from '@vueuse/core'
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
} from '../base/storageIO'

/**
 * Owns the auth identity used by all scoped local persistence consumers.
 * Mounted at the application root so workflow and agent storage do not depend
 * on GraphCanvas or another feature composable having initialized first.
 */
export function useStorageScopeLifecycle(): void {
  const { resolvedUserInfo } = useCurrentUser()
  const teamWorkspaceStore = useTeamWorkspaceStore()
  let stopWorkspaceReadinessWatcher: (() => void) | undefined

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

  watch(
    resolvedUserInfo,
    (user) => {
      const nextIdentity = user?.id ?? null
      if (nextIdentity === getStorageIdentity()) return

      stopPendingWorkspaceReadinessWatcher()
      if (isCloud) prepareWorkflowLogoutTransition()
      if (isCloud && getStorageIdentity() !== null) {
        teamWorkspaceStore.resetForIdentityChange()
      }
      setStorageIdentity(nextIdentity)
      setStorageWorkspaceId(null)

      if (isCloud && nextIdentity !== null) releaseIdentityFenceWhenReady()
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
