import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
import { defineStore } from 'pinia'
import { computed, shallowRef, watch } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'
import { pendingServerFact } from '@/platform/serverFacts/pendingServerFact'
import {
  DEPLOYMENT_LISTING_BACKSTOP_MS,
  DEPLOYMENT_LISTING_RETRY_DELAYS_MS
} from '@/platform/workspace/api/deploymentListingTimeouts'
import {
  WorkspaceApiError,
  workspaceApi
} from '@/platform/workspace/api/workspaceApi'
import {
  hasDeploymentLink,
  readDeploymentHint,
  setDeploymentHint,
  setUnconfirmedCloudHint
} from '@/platform/workspace/deploymentHint'
import type {
  DeploymentPickEvent,
  DeploymentPickSource,
  DeploymentPickState
} from '@/platform/workspace/deploymentPickState'
import {
  changeBetween,
  loadedEvent,
  reduceDeploymentPick
} from '@/platform/workspace/deploymentPickState'
import { reloadForDeploymentSwitch } from '@/platform/workspace/deploymentSwitchReload'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

/**
 * What picking a linked deployment did: `picked` (the page is reloading onto
 * it), `unchanged` (this browser already runs on it), or `refused` with the
 * server's reason.
 */
type LinkPickOutcome =
  | { kind: 'picked' }
  | { kind: 'unchanged' }
  | { kind: 'timedOut' }
  | { kind: 'refused'; message: string }

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
  /**
   * The workspace's default deployment when it is gone: still recorded, so
   * an owner can clear it, but members on it run on Comfy Cloud.
   */
  const goneDefaultDeploymentId = computed(() =>
    'goneDefaultDeploymentId' in state.value
      ? state.value.goneDefaultDeploymentId
      : null
  )
  /**
   * Set once a listing says ingest found this browser's own pick gone and
   * cleared it. Only that one listing says so, so the page keeps it until a
   * later listing shows a deployment picked again.
   */
  const sawPickGone = shallowRef(false)
  const goneDeployment = computed<'pick' | 'default' | null>(() => {
    if (sawPickGone.value) return 'pick'
    if (
      goneDefaultDeploymentId.value !== null &&
      pickSource.value !== 'browser'
    ) {
      return 'default'
    }
    return null
  })
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
  const canSetDefault = computed(() =>
    pendingServerFact(
      'BE-20674',
      workspaceStore.activeWorkspace?.role === 'owner'
    )
  )
  /**
   * True once a listing has answered, and while a reload of it is in flight.
   * False before any listing answers, when the account cannot pick, and when
   * the load failed with no listing to show. A listing that answered is shown
   * even when a newer load fails or never answers.
   */
  const isVisible = computed(() => 'deployments' in state.value)
  const isSwitching = computed(() => state.value.phase === 'switching')
  const listingRefused = shallowRef(false)
  /**
   * The deployment this page booted on, from the first listing that
   * answered: null for Comfy Cloud (a gone pick, a rollout refusal, an ingest
   * without these routes, or a boot listing the editor gave up on; see
   * `bootOnComfyCloud`), undefined before the model source is known. The
   * editor's node catalog is that deployment's Release as it was at boot,
   * since a pick or a workspace switch reloads the page.
   */
  const bootDeployment = shallowRef<WorkspaceDeployment | null | undefined>(
    undefined
  )
  /**
   * A change made elsewhere since this page booted that its nodes do not
   * show, read from the latest listing: `release` when its deployment now
   * runs another Release, `deployment` when it now runs on another
   * deployment or Comfy Cloud with other nodes (an owner changed the
   * default it follows, or its pick is gone). Jobs already run on the new
   * one; only a reload brings its nodes. Null when nothing changed.
   */
  const changeSinceBoot = computed(() => {
    const boot = bootDeployment.value
    if (boot === undefined || !isVisible.value) return null
    return changeBetween(boot, pickedDeployment.value)
  })
  const switcherOpenAsks = shallowRef(0)

  function requestSwitcherOpen() {
    switcherOpenAsks.value++
  }

  /**
   * Orders the answers. Each `load()` takes the next number (`latestRequest`);
   * `lastApplied` is the number of the newest answer put on screen. A listing
   * or a 403 applies when it is newer than that, so a listing that answered
   * stays shown when a newer load fails or never answers; an older listing
   * still passes on a gone pick it reports. A plain failure
   * applies only when it is the latest load asked for and nothing newer has
   * applied, so it never replaces a listing that may still arrive. A default
   * the server took moves `lastApplied` up to `latestRequest`, which drops
   * every listing asked for before the change.
   */
  let latestRequest = 0
  let lastApplied = 0
  let reportedLoadFailure = false

  function load(): Promise<void> {
    return loadListing([])
  }

  /**
   * Load the listing, retrying a failure with no definite answer after each
   * of `retryDelaysMs` while this workspace is still the active one.
   */
  async function loadListing(retryDelaysMs: readonly number[]): Promise<void> {
    const id = workspaceStore.workspaceId
    if (!id) return
    const request = ++latestRequest
    const event = await listingEvent(
      id,
      retryDelaysMs,
      () => workspaceStore.workspaceId === id,
      (err) => noteLoadFailure(id, err)
    )
    const workspaceChangedMeanwhile = workspaceStore.workspaceId !== id
    if (workspaceChangedMeanwhile) return
    applyAnswer(id, request, event)
  }

  function applyAnswer(
    workspaceId: string,
    request: number,
    event: DeploymentPickEvent
  ) {
    if (request <= lastApplied) {
      if (event.type === 'loaded') keepPickGone(event.gonePickedDeploymentId)
      return
    }
    if (event.type === 'loadFailed') {
      if (request === latestRequest) dispatch(event)
      return
    }
    lastApplied = request
    dispatch(event)
    listingRefused.value = event.type === 'loadRefused'
    if (event.type === 'loaded') noteListing(event.gonePickedDeploymentId)
    if (event.type === 'loadRefused' && bootDeployment.value === undefined) {
      bootDeployment.value = null
    }
    rememberBootTarget(workspaceId)
  }

  function noteLoadFailure(workspaceId: string, err: unknown) {
    if (
      isTransient(err) &&
      readDeploymentHint(workspaceId) === 'unknown' &&
      !hasDeploymentLink()
    ) {
      setUnconfirmedCloudHint(workspaceId)
    }
    if (reportedLoadFailure || workspaceStore.workspaceId !== workspaceId)
      return
    reportedLoadFailure = true
    reportError(err, {
      surface: 'workspace',
      errorType: 'error_loading_deployment_listing'
    })
  }

  function rememberBootTarget(workspaceId: string) {
    setDeploymentHint(
      workspaceId,
      pickedDeployment.value?.deployment_id ?? null
    )
  }

  function reloadOnto(workspaceId: string, deploymentId: string | null) {
    setDeploymentHint(workspaceId, deploymentId)
    reloadForDeploymentSwitch(() => {
      dispatch({ type: 'switchFailed' })
      void load()
    })
  }

  function keepPickGone(gonePickedDeploymentId: string | null) {
    if (gonePickedDeploymentId !== null && pickedDeployment.value === null) {
      sawPickGone.value = true
    }
  }

  function noteListing(gonePickedDeploymentId: string | null) {
    if (gonePickedDeploymentId !== null) sawPickGone.value = true
    else if (pickedDeployment.value !== null) sawPickGone.value = false
    if (bootDeployment.value === undefined) {
      bootDeployment.value = pickedDeployment.value
    }
  }

  let firstLoad: Promise<void> | null = null

  /**
   * Another workspace, or another account (signed in without a reload), has
   * its own deployments: drop the old listing at once rather than show it
   * until the new one answers, and drop any listing still in flight. The
   * deployment this page booted on stays, since its nodes are still the
   * editor's until a reload.
   */
  watch(
    () => workspaceStore.workspaceId,
    () => {
      dispatch({ type: 'workspaceChanged' })
      sawPickGone.value = false
      listingRefused.value = false
      lastApplied = latestRequest
      firstLoad = null
    },
    { flush: 'sync' }
  )

  /**
   * The page's first load, started at boot so the editor learns which
   * deployment it booted on; later calls wait on that same load. It retries
   * a failure with no definite answer (`DEPLOYMENT_LISTING_RETRY_DELAYS_MS`)
   * and reports only the last one.
   */
  function loadOnce(): Promise<void> {
    if (!firstLoad && workspaceStore.workspaceId) {
      firstLoad = loadListing(DEPLOYMENT_LISTING_RETRY_DELAYS_MS)
    }
    return firstLoad ?? Promise.resolve()
  }

  /**
   * The editor starts on Comfy Cloud's models when the boot listing failed
   * or did not answer in time. A listing that answers later does not change
   * that; it shows as `changeSinceBoot` when it names a deployment.
   */
  function bootOnComfyCloud() {
    if (bootDeployment.value === undefined) bootDeployment.value = null
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
    return pickAndReload(id, deploymentId)
  }

  /**
   * Pick the deployment a link names (BE-20294), then reload like `pick`.
   * It waits for the page's first listing, so a link to what this browser
   * already runs on does nothing, but it does not need that listing to have
   * answered: an account outside the rollout, or a deployment that is gone
   * or not the workspace's, gets the server's refusal rather than nothing.
   */
  async function pickFromLink(deploymentId: string): Promise<LinkPickOutcome> {
    const id = workspaceStore.workspaceId
    if (!id || state.value.phase === 'switching') return { kind: 'unchanged' }
    let timeout: ReturnType<typeof setTimeout> | undefined
    const completed = await Promise.race([
      loadOnce().then(() => true),
      new Promise<false>((resolve) => {
        timeout = setTimeout(
          () => resolve(false),
          DEPLOYMENT_LISTING_BACKSTOP_MS
        )
      })
    ]).finally(() => clearTimeout(timeout))
    if (!completed) return { kind: 'timedOut' }
    if (workspaceStore.workspaceId !== id || isSwitching.value) {
      return { kind: 'unchanged' }
    }
    if (deploymentId === pickedDeploymentId.value) return { kind: 'unchanged' }
    return pickLinkAndReload(id, deploymentId)
  }

  async function pickLinkAndReload(
    workspaceId: string,
    deploymentId: string
  ): Promise<LinkPickOutcome> {
    dispatch({ type: 'switchStarted', target: deploymentId })
    const controller = new AbortController()
    let timeout: ReturnType<typeof setTimeout> | undefined
    const selection = workspaceApi
      .pickDeployment(
        workspaceId,
        { deployment_id: deploymentId },
        controller.signal
      )
      .then<LinkPickOutcome, LinkPickOutcome>(
        () => ({ kind: 'picked' }),
        (error: unknown) => ({ kind: 'refused', message: errorMessage(error) })
      )
    const outcome = await Promise.race([
      selection,
      new Promise<LinkPickOutcome>((resolve) => {
        timeout = setTimeout(() => {
          resolve({ kind: 'timedOut' })
          controller.abort()
        }, DEPLOYMENT_LISTING_BACKSTOP_MS)
      })
    ]).finally(() => clearTimeout(timeout))
    if (workspaceStore.workspaceId !== workspaceId) return { kind: 'unchanged' }
    if (outcome.kind === 'picked') reloadOnto(workspaceId, deploymentId)
    else dispatch({ type: 'switchFailed' })
    return outcome
  }

  async function pickAndReload(
    workspaceId: string,
    deploymentId: string | null
  ): Promise<string | null> {
    dispatch({ type: 'switchStarted', target: deploymentId })
    try {
      if (deploymentId === null) {
        await workspaceApi.clearDeployment(workspaceId)
      } else {
        await workspaceApi.pickDeployment(workspaceId, {
          deployment_id: deploymentId
        })
      }
    } catch (err) {
      dispatch({ type: 'switchFailed' })
      return errorMessage(err)
    }
    reloadOnto(workspaceId, deploymentId)
    return null
  }

  async function followInPlace(workspaceId: string): Promise<string | null> {
    dispatch({ type: 'switchStarted', target: pickedDeploymentId.value })
    try {
      await workspaceApi.clearDeployment(workspaceId, { follow: 'workspace' })
    } catch (err) {
      dispatch({ type: 'switchFailed' })
      return errorMessage(err)
    }
    lastApplied = latestRequest
    dispatch({ type: 'followedInPlace' })
    await load()
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
    if (defaultDeploymentId.value === pickedDeploymentId.value) {
      return followInPlace(id)
    }
    dispatch({ type: 'switchStarted', target: defaultDeploymentId.value })
    try {
      await workspaceApi.clearDeployment(id, { follow: 'workspace' })
    } catch (err) {
      dispatch({ type: 'switchFailed' })
      return errorMessage(err)
    }
    reloadOnto(id, defaultDeploymentId.value)
    return null
  }

  /** True when this default would change what this browser runs on. */
  function defaultMovesThisBrowser(deploymentId: string | null): boolean {
    return followsWorkspace.value && deploymentId !== pickedDeploymentId.value
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
    const recordedDefault =
      defaultDeploymentId.value ?? goneDefaultDeploymentId.value
    if (deploymentId === recordedDefault) return null
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
    if (defaultMovesThisBrowser(deploymentId)) {
      reloadOnto(id, deploymentId)
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
    goneDeployment,
    pickSource,
    defaultDeploymentId,
    goneDefaultDeploymentId,
    defaultDeployment,
    followsWorkspace,
    canSetDefault,
    isVisible,
    isSwitching,
    listingRefused,
    bootDeployment,
    changeSinceBoot,
    switcherOpenAsks,
    load,
    loadOnce,
    bootOnComfyCloud,
    pick,
    pickFromLink,
    followWorkspace,
    setDefault,
    defaultMovesThisBrowser,
    requestSwitcherOpen
  }
})

async function listingEvent(
  workspaceId: string,
  retryDelaysMs: readonly number[],
  stillWanted: () => boolean,
  onFailure: (err: unknown) => void
): Promise<DeploymentPickEvent> {
  for (let attempt = 0; ; attempt++) {
    try {
      return loadedEvent(await workspaceApi.listDeployments(workspaceId))
    } catch (err) {
      const retriesLeft = attempt < retryDelaysMs.length
      if (!retriesLeft || !isTransient(err) || !stillWanted()) {
        return loadFailure(err, onFailure)
      }
      await new Promise((resolve) =>
        setTimeout(resolve, retryDelaysMs[attempt])
      )
      // Another workspace took over: this answer would be dropped anyway.
      if (!stillWanted()) return { type: 'loadFailed' }
    }
  }
}

/**
 * A listing request that got no definite answer: no response (a network
 * error or the request timeout), a 408 or 429, or a 5xx. A failure before
 * the request (the sign-in step) is not retried.
 */
function isTransient(err: unknown): boolean {
  if (!(err instanceof WorkspaceApiError)) return false
  const { status } = err
  return (
    status === undefined || status === 408 || status === 429 || status >= 500
  )
}

function loadFailure(
  err: unknown,
  onFailure: (err: unknown) => void
): DeploymentPickEvent {
  if (
    err instanceof WorkspaceApiError &&
    (err.status === 403 || err.status === 404)
  ) {
    return { type: 'loadRefused' }
  }
  onFailure(err)
  return { type: 'loadFailed' }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
