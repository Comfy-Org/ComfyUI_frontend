import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'

import {
  WorkspaceApiError,
  workspaceApi
} from '@/platform/workspace/api/workspaceApi'
import type {
  ReleasePickEvent,
  ReleasePickState
} from '@/platform/workspace/releasePickState'
import { reduceReleasePick } from '@/platform/workspace/releasePickState'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

/**
 * The Release this browser runs on and the Releases it may pick (FE-2434).
 *
 * A pick changes what the editor is served at boot (the Release's node
 * catalog and its packs' JavaScript), so a successful pick or clear reloads
 * the page rather than patching the running editor.
 */
export const useReleasePickStore = defineStore('releasePick', () => {
  const workspaceStore = useTeamWorkspaceStore()

  const state = shallowRef<ReleasePickState>({ phase: 'idle' })

  function dispatch(event: ReleasePickEvent) {
    state.value = reduceReleasePick(state.value, event)
  }

  const releases = computed(() =>
    'releases' in state.value ? state.value.releases : []
  )
  const pickedReleaseId = computed(() =>
    'pickedReleaseId' in state.value ? state.value.pickedReleaseId : null
  )
  const pickedRelease = computed(
    () =>
      releases.value.find((r) => r.release_id === pickedReleaseId.value) ?? null
  )
  const buildsVisible = computed(() =>
    'buildsVisible' in state.value ? state.value.buildsVisible : true
  )
  /** False until the listing has answered, and when the account cannot pick. */
  const isVisible = computed(
    () => state.value.phase !== 'idle' && state.value.phase !== 'hidden'
  )
  const isSwitching = computed(() => state.value.phase === 'switching')

  async function load(): Promise<void> {
    const id = workspaceStore.workspaceId
    if (!id) return
    dispatch({ type: 'loadStarted' })
    try {
      const listing = await workspaceApi.listReleases(id)
      if (workspaceStore.workspaceId !== id) return
      dispatch({
        type: 'loaded',
        releases: listing.releases,
        pickedReleaseId: listing.picked_release_id ?? null,
        buildsVisible: listing.builds_visible
      })
    } catch (err) {
      if (workspaceStore.workspaceId !== id) return
      if (err instanceof WorkspaceApiError && err.status === 403) {
        dispatch({ type: 'loadRefused' })
        return
      }
      dispatch({ type: 'loadFailed', message: errorMessage(err) })
    }
  }

  /**
   * Pick a Release for this browser, or null for Comfy Cloud, then reload so
   * the editor boots on it. Resolves to the server's refusal, or null when
   * the pick took (the page is reloading).
   */
  async function pick(releaseId: string | null): Promise<string | null> {
    const id = workspaceStore.workspaceId
    if (!id || state.value.phase !== 'ready') return null
    if (releaseId === pickedReleaseId.value) return null
    dispatch({ type: 'switchStarted', target: releaseId })
    try {
      if (releaseId === null) {
        await workspaceApi.clearRelease(id)
      } else {
        await workspaceApi.pickRelease(id, { release_id: releaseId })
      }
    } catch (err) {
      dispatch({ type: 'switchFailed' })
      return errorMessage(err)
    }
    window.location.reload()
    return null
  }

  return {
    state,
    releases,
    pickedReleaseId,
    pickedRelease,
    buildsVisible,
    isVisible,
    isSwitching,
    load,
    pick
  }
})

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
