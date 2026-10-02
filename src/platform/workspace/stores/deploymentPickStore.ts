import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'

import {
  WorkspaceApiError,
  workspaceApi
} from '@/platform/workspace/api/workspaceApi'
import type {
  DeploymentPickEvent,
  DeploymentPickSource,
  DeploymentPickState
} from '@/platform/workspace/deploymentPickState'
import {
  loadedEvent,
  reduceDeploymentPick
} from '@/platform/workspace/deploymentPickState'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

/**
 * The deployment this browser runs on and the deployments it may pick
 * (FE-2434), plus the workspace's default deployment an owner sets for
 * members with no pick of their own (BE-17480). A deployment keeps its URL
 * while its owner updates it to new Releases, so a pick follows those updates.
 *
 * A pick changes what the editor is served at boot (the node
 * catalog of the Release the deployment runs and its packs' JavaScript), so a successful pick or clear reloads
 * the page rather than patching the running editor.
 */
export const useDeploymentPickStore = defineStore('deploymentPick', () => {
  const workspaceStore = useTeamWorkspaceStore()

  const state = shallowRef<DeploymentPickState>({ phase: 'idle' })

  function dispatch(event: DeploymentPickEvent) {
    state.value = reduceDeploymentPick(state.value, event)
  }

  const deployments = computed(() =>
    'deployments' in state.value ? state.value.deployments : []
  )
  const pickedDeploymentId = computed(() =>
    'pickedDeploymentId' in state.value ? state.value.pickedDeploymentId : null
  )
  const pickedDeployment = computed(
    () =>
      deployments.value.find(
        (d) => d.deployment_id === pickedDeploymentId.value
      ) ?? null
  )
  const pickSource = computed<DeploymentPickSource | null>(() =>
    'pickSource' in state.value ? state.value.pickSource : null
  )
  const defaultDeploymentId = computed(() =>
    'defaultDeploymentId' in state.value
      ? state.value.defaultDeploymentId
      : null
  )
  const defaultDeployment = computed(
    () =>
      deployments.value.find(
        (d) => d.deployment_id === defaultDeploymentId.value
      ) ?? null
  )
  /**
   * True when this browser has no pick of its own and so runs on whatever
   * the workspace says: its default deployment, or Comfy Cloud without one.
   */
  const followsWorkspace = computed(() => pickSource.value !== 'browser')
  /** Only a workspace owner may set or clear the default deployment. */
  const canSetDefault = computed(
    () => workspaceStore.activeWorkspace?.role === 'owner'
  )
  const buildsVisible = computed(() =>
    'buildsVisible' in state.value ? state.value.buildsVisible : true
  )
  /**
   * True once a listing has answered, and while a reload of it is in flight.
   * False before any listing answers, when the account cannot pick, and when
   * the load failed with no listing to show. A listing that answered is shown
   * even when a newer load fails or never answers.
   */
  const isVisible = computed(() => 'deployments' in state.value)
  const isSwitching = computed(() => state.value.phase === 'switching')

  /**
   * Orders the answers. Each `load()` takes the next number (`latestRequest`);
   * `lastApplied` is the number of the newest answer put on screen. A listing
   * or a 403 applies when it is newer than that, so a listing that answered
   * stays shown when a newer load fails or never answers. A plain failure
   * applies only when it is the latest load asked for and nothing newer has
   * applied, so it never replaces a listing that may still arrive. A default
   * the server took moves `lastApplied` up to `latestRequest`, which drops
   * every listing asked for before the change.
   */
  let latestRequest = 0
  let lastApplied = 0

  async function load(): Promise<void> {
    const id = workspaceStore.workspaceId
    if (!id) return
    const request = ++latestRequest
    let event: DeploymentPickEvent
    try {
      event = loadedEvent(await workspaceApi.listDeployments(id))
    } catch (err) {
      event = loadFailure(err)
    }
    // The workspace may have changed while the listing was in flight.
    if (workspaceStore.workspaceId !== id) return
    if (request <= lastApplied) return
    if (event.type === 'loadFailed') {
      if (request === latestRequest) dispatch(event)
      return
    }
    lastApplied = request
    dispatch(event)
  }

  /**
   * Pick a deployment for this browser, or null for Comfy Cloud, then reload so
   * the editor boots on it. Resolves to the server's refusal, or null when
   * the pick took (the page is reloading) or there was nothing to do.
   * Choosing what this browser already runs on does nothing, so a browser
   * that follows the workspace default keeps following it. Picking Comfy
   * Cloud while following a default is this browser's own choice: it wins
   * over the default, until `followWorkspace` drops it.
   */
  async function pick(deploymentId: string | null): Promise<string | null> {
    const id = workspaceStore.workspaceId
    if (!id || state.value.phase !== 'ready') return null
    if (deploymentId === pickedDeploymentId.value) return null
    dispatch({ type: 'switchStarted', target: deploymentId })
    try {
      if (deploymentId === null) {
        await workspaceApi.clearDeployment(id)
      } else {
        await workspaceApi.pickDeployment(id, { deployment_id: deploymentId })
      }
    } catch (err) {
      dispatch({ type: 'switchFailed' })
      return errorMessage(err)
    }
    window.location.reload()
    return null
  }

  /**
   * Drop this browser's own pick so it runs on whatever the workspace says
   * (its default deployment, or Comfy Cloud), then reload. Resolves like `pick`.
   */
  async function followWorkspace(): Promise<string | null> {
    const id = workspaceStore.workspaceId
    if (!id || state.value.phase !== 'ready') return null
    if (followsWorkspace.value) return null
    dispatch({ type: 'switchStarted', target: defaultDeploymentId.value })
    try {
      await workspaceApi.clearDeployment(id, { follow: 'workspace' })
    } catch (err) {
      dispatch({ type: 'switchFailed' })
      return errorMessage(err)
    }
    window.location.reload()
    return null
  }

  /**
   * Set the workspace's default deployment (owner only), or clear it with null.
   * Members with no pick of their own move to it at their next boot. This
   * browser reloads only when it has no pick of its own, since only then
   * does the new default change what it runs on. Otherwise the new default
   * shows at once and the listing is refreshed to confirm it; a failed
   * refresh keeps the new default on screen, since the server has it, and a
   * listing asked for before the change is dropped when it lands.
   * Resolves to the server's refusal, or null when the default took.
   */
  async function setDefault(
    deploymentId: string | null
  ): Promise<string | null> {
    const id = workspaceStore.workspaceId
    if (!id || state.value.phase !== 'ready') return null
    if (deploymentId === defaultDeploymentId.value) return null
    dispatch({ type: 'switchStarted', target: pickedDeploymentId.value })
    try {
      if (deploymentId === null) {
        await workspaceApi.clearDefaultDeployment(id)
      } else {
        await workspaceApi.setDefaultDeployment(id, {
          deployment_id: deploymentId
        })
      }
    } catch (err) {
      dispatch({ type: 'switchFailed' })
      return errorMessage(err)
    }
    if (followsWorkspace.value) {
      window.location.reload()
      return null
    }
    lastApplied = latestRequest
    dispatch({ type: 'defaultChanged', defaultDeploymentId: deploymentId })
    await load()
    return null
  }

  return {
    state,
    deployments,
    pickedDeploymentId,
    pickedDeployment,
    pickSource,
    defaultDeploymentId,
    defaultDeployment,
    followsWorkspace,
    canSetDefault,
    buildsVisible,
    isVisible,
    isSwitching,
    load,
    pick,
    followWorkspace,
    setDefault
  }
})

/**
 * A 403 means the account is outside the rollout: hide the switcher. Any
 * other failure (a 404 from an ingest without these routes, a 5xx, a network
 * error, no signed-in user) hides it too unless a listing is already shown.
 */
function loadFailure(err: unknown): DeploymentPickEvent {
  if (err instanceof WorkspaceApiError && err.status === 403) {
    return { type: 'loadRefused' }
  }
  return { type: 'loadFailed' }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
