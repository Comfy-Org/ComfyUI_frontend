import type {
  WorkspaceDeployment,
  WorkspaceDeploymentList
} from '@comfyorg/ingest-types'

/**
 * Which developer-platform deployment this browser runs its Cloud jobs on, and
 * the list it may pick from (FE-2434). A deployment keeps one URL while its
 * owner updates it to new Releases, so a pick follows those updates. The pick
 * itself is an HttpOnly cookie ingest sets; the editor learns it from the
 * listing and never reads it.
 */
/** Where the current pick came from (BE-17480). */
export type DeploymentPickSource = 'browser' | 'workspace_default'

interface DeploymentListing {
  deployments: WorkspaceDeployment[]
  pickedDeploymentId: string | null
  /**
   * `browser` when this browser picked for itself (a deployment, or
   * Comfy Cloud); `workspace_default` when it follows the workspace's default
   * deployment; null when there is neither, so it runs on Comfy Cloud.
   */
  pickSource: DeploymentPickSource | null
  /** The workspace's default deployment an owner set, or null. */
  defaultDeploymentId: string | null
  /**
   * This browser's own pick, when ingest found it gone (deleted, or no
   * longer the workspace's) and cleared it. Only the listing that cleared
   * it says so; the browser is on Comfy Cloud.
   */
  gonePickedDeploymentId: string | null
  /**
   * The workspace's default deployment, when it is gone; then
   * `defaultDeploymentId` is null. Said on every listing until an owner
   * sets or clears the default.
   */
  goneDefaultDeploymentId: string | null
  buildsVisible: boolean
}

/**
 * A reload of the listing does not change the state until it answers: the
 * last listing stays on screen (or the switcher stays hidden) meanwhile, so
 * reopening the popover never flashes "Comfy Cloud" or no default. A listing
 * that lands while a switch is in flight updates what is shown but does not
 * end the switch, so a second pick cannot go out before the first answers.
 */
export type DeploymentPickState =
  /** Nothing has answered yet; the switcher is not shown. */
  | { phase: 'idle' }
  /**
   * The account is outside the rollout, the session cannot pick, or the
   * first listing failed (for example ingest without these routes).
   */
  | { phase: 'hidden' }
  | ({ phase: 'ready' } & DeploymentListing)
  /**
   * A pick, a clear or a new default is in flight. A pick or a clear reloads
   * the page on success; a new default reloads it only when this browser has
   * no pick of its own, since only then does it change what this browser
   * runs on.
   */
  | ({ phase: 'switching'; target: string | null } & DeploymentListing)

export type DeploymentPickEvent =
  | ({ type: 'loaded' } & DeploymentListing)
  /** A 403: the account is outside the rollout, whatever was shown before. */
  | { type: 'loadRefused' }
  /** Any other failure: keep a listing already shown, else stay hidden. */
  | { type: 'loadFailed' }
  | { type: 'switchStarted'; target: string | null }
  /** The server refused the switch. */
  | { type: 'switchFailed' }
  /**
   * The server took a new workspace default (or its clearing) and this
   * browser does not reload: show it now, whatever the refresh after it
   * answers, and end the switch.
   */
  | { type: 'defaultChanged'; defaultDeploymentId: string | null }

/** The `loaded` event for a listing from GET /api/workspaces/{id}/deployments. */
export function loadedEvent(
  listing: WorkspaceDeploymentList
): DeploymentPickEvent {
  return {
    type: 'loaded',
    deployments: listing.items,
    pickedDeploymentId: listing.picked_deployment_id ?? null,
    pickSource: listing.pick_source ?? null,
    defaultDeploymentId: listing.default_deployment_id ?? null,
    gonePickedDeploymentId: listing.gone_picked_deployment_id ?? null,
    goneDefaultDeploymentId: listing.gone_default_deployment_id ?? null,
    buildsVisible: listing.builds_visible
  }
}

/** The listing fields of a state or a `loaded` event, without the rest. */
function listingOf(source: DeploymentListing): DeploymentListing {
  return {
    deployments: source.deployments,
    pickedDeploymentId: source.pickedDeploymentId,
    pickSource: source.pickSource,
    defaultDeploymentId: source.defaultDeploymentId,
    gonePickedDeploymentId: source.gonePickedDeploymentId,
    goneDefaultDeploymentId: source.goneDefaultDeploymentId,
    buildsVisible: source.buildsVisible
  }
}

export function reduceDeploymentPick(
  state: DeploymentPickState,
  event: DeploymentPickEvent
): DeploymentPickState {
  switch (event.type) {
    case 'loaded':
      // A switch in flight stays in flight; it shows the newer listing.
      if (state.phase === 'switching') {
        return {
          phase: 'switching',
          target: state.target,
          ...listingOf(event)
        }
      }
      return { phase: 'ready', ...listingOf(event) }
    case 'loadRefused':
      return { phase: 'hidden' }
    case 'loadFailed':
      return 'deployments' in state ? state : { phase: 'hidden' }
    case 'switchStarted':
      if (state.phase !== 'ready') return state
      return { phase: 'switching', target: event.target, ...listingOf(state) }
    case 'switchFailed':
      if (state.phase !== 'switching') return state
      return { phase: 'ready', ...listingOf(state) }
    case 'defaultChanged':
      if (state.phase !== 'switching') return state
      return {
        phase: 'ready',
        ...listingOf(state),
        defaultDeploymentId: event.defaultDeploymentId
      }
  }
}
