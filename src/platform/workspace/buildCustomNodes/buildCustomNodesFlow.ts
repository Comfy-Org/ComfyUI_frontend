import type {
  DeploymentBuild,
  NodePack,
  ReleaseBuild,
  StartedRelease
} from '@/platform/workspace/buildCustomNodes/buildCustomNodesTypes'
import type {
  NodePackVersionChoice,
  PickedNodePack
} from '@/platform/workspace/buildCustomNodes/nodePackChoice'

/** The deployment being changed, its Build as read, and the packs picked for it. */
export interface BuildSession {
  deploymentId: string
  deploymentName: string
  build: DeploymentBuild
  picks: readonly PickedNodePack[]
}

interface DeploymentTarget {
  deploymentId: string
  deploymentName: string
}

export type BuildCustomNodesState =
  | { phase: 'idle' }
  | ({ phase: 'loading' } & DeploymentTarget)
  | ({ phase: 'loadFailed'; message: string } & DeploymentTarget)
  | { phase: 'picking'; session: BuildSession }
  | { phase: 'viewing'; session: BuildSession }
  | { phase: 'reviewing'; session: BuildSession; refusal: string | null }
  | { phase: 'submitting'; session: BuildSession }
  | {
      phase: 'building'
      session: BuildSession
      release: StartedRelease | null
      progress: ReleaseBuild | null
      startedAt: number | null
    }
  | { phase: 'buildFailed'; session: BuildSession; release: ReleaseBuild }
  | { phase: 'redeploying'; session: BuildSession; release: ReleaseBuild }
  | {
      phase: 'moveFailed'
      session: BuildSession
      release: ReleaseBuild
      message: string | null
    }

export type BuildCustomNodesEvent =
  | ({ type: 'opened' } & DeploymentTarget)
  | { type: 'loaded'; build: DeploymentBuild }
  | { type: 'loadFailed'; message: string }
  | { type: 'packToggled'; pack: NodePack; choice: NodePackVersionChoice }
  | { type: 'versionChosen'; pack: NodePack; choice: NodePackVersionChoice }
  | { type: 'reviewRequested' }
  | { type: 'backToPicking' }
  | { type: 'submitted' }
  | { type: 'saved'; updatedAt: string }
  | { type: 'releaseStarted'; release: StartedRelease; at: number }
  | { type: 'refused'; message: string }
  | { type: 'releaseProgressed'; release: ReleaseBuild }
  | { type: 'retried' }
  | { type: 'moveRefused'; message: string | null }
  | { type: 'moveRetried'; build: DeploymentBuild }
  | { type: 'moveLanded' }
  | { type: 'dismissed' }

type StateIn<Phase extends BuildCustomNodesState['phase']> = Extract<
  BuildCustomNodesState,
  { phase: Phase }
>

const RUNNING_PHASES = new Set<BuildCustomNodesState['phase']>([
  'submitting',
  'building',
  'redeploying'
])

/** True while a save, build or redeploy is under way and must not be abandoned. */
export function isRunning(state: BuildCustomNodesState): boolean {
  return RUNNING_PHASES.has(state.phase)
}

function withPicks(
  session: BuildSession,
  picks: readonly PickedNodePack[]
): BuildSession {
  return { ...session, picks }
}

function togglePick(
  session: BuildSession,
  pack: NodePack,
  choice: NodePackVersionChoice
): BuildSession {
  const remaining = session.picks.filter((pick) => pick.pack.id !== pack.id)
  return remaining.length < session.picks.length
    ? withPicks(session, remaining)
    : withPicks(session, [...session.picks, { pack, choice }])
}

function choosePick(
  session: BuildSession,
  pack: NodePack,
  choice: NodePackVersionChoice
): BuildSession {
  const known = session.picks.some((pick) => pick.pack.id === pack.id)
  return withPicks(
    session,
    known
      ? session.picks.map((pick) =>
          pick.pack.id === pack.id ? { pack, choice } : pick
        )
      : [...session.picks, { pack, choice }]
  )
}

function withUpdatedAt(session: BuildSession, updatedAt: string): BuildSession {
  const { build } = session
  return {
    ...session,
    build: { ...build, build: { ...build.build, updated_at: updatedAt } }
  }
}

function progressed(
  state: StateIn<'building'>,
  release: ReleaseBuild
): BuildCustomNodesState {
  if (state.release?.release_id !== release.release_id) return state
  if (release.status !== 'complete') return { ...state, progress: release }
  return release.deployable
    ? { phase: 'redeploying', session: state.session, release }
    : { phase: 'buildFailed', session: state.session, release }
}

function loadedState(
  target: DeploymentTarget,
  build: DeploymentBuild
): BuildCustomNodesState {
  const session: BuildSession = {
    deploymentId: target.deploymentId,
    deploymentName: target.deploymentName,
    build,
    picks: []
  }
  return build.can_change_build
    ? { phase: 'picking', session }
    : { phase: 'viewing', session }
}

function reducePicking(
  state: StateIn<'picking'>,
  event: BuildCustomNodesEvent
): BuildCustomNodesState {
  switch (event.type) {
    case 'packToggled':
      return {
        ...state,
        session: togglePick(state.session, event.pack, event.choice)
      }
    case 'versionChosen':
      return {
        ...state,
        session: choosePick(state.session, event.pack, event.choice)
      }
    case 'reviewRequested':
      return state.session.picks.length > 0
        ? { phase: 'reviewing', session: state.session, refusal: null }
        : state
    default:
      return state
  }
}

function reduceBuilding(
  state: StateIn<'building'>,
  event: BuildCustomNodesEvent
): BuildCustomNodesState {
  switch (event.type) {
    case 'releaseStarted':
      return state.release === null
        ? { ...state, release: event.release, startedAt: event.at }
        : state
    case 'refused':
      return state.release === null
        ? { phase: 'reviewing', session: state.session, refusal: event.message }
        : state
    case 'releaseProgressed':
      return progressed(state, event.release)
    default:
      return state
  }
}

function startedBuilding(session: BuildSession): BuildCustomNodesState {
  return {
    phase: 'building',
    session,
    release: null,
    progress: null,
    startedAt: null
  }
}

function reduceLoading(
  state: StateIn<'loading'>,
  event: BuildCustomNodesEvent
): BuildCustomNodesState {
  if (event.type === 'loaded') return loadedState(state, event.build)
  if (event.type !== 'loadFailed') return state
  return {
    phase: 'loadFailed',
    deploymentId: state.deploymentId,
    deploymentName: state.deploymentName,
    message: event.message
  }
}

function reduceReviewing(
  state: StateIn<'reviewing'>,
  event: BuildCustomNodesEvent
): BuildCustomNodesState {
  if (event.type === 'backToPicking')
    return { phase: 'picking', session: state.session }
  if (event.type === 'submitted')
    return { phase: 'submitting', session: state.session }
  return state
}

function reduceSubmitting(
  state: StateIn<'submitting'>,
  event: BuildCustomNodesEvent
): BuildCustomNodesState {
  if (event.type === 'saved')
    return startedBuilding(withUpdatedAt(state.session, event.updatedAt))
  if (event.type === 'refused')
    return {
      phase: 'reviewing',
      session: state.session,
      refusal: event.message
    }
  return state
}

function reduceBuildFailed(
  state: StateIn<'buildFailed'>,
  event: BuildCustomNodesEvent
): BuildCustomNodesState {
  if (event.type === 'backToPicking')
    return { phase: 'picking', session: state.session }
  if (event.type === 'retried') return startedBuilding(state.session)
  return state
}

function reduceRedeploying(
  state: StateIn<'redeploying'>,
  event: BuildCustomNodesEvent
): BuildCustomNodesState {
  if (event.type === 'moveRefused')
    return { ...state, phase: 'moveFailed', message: event.message }
  if (event.type === 'moveLanded') return { phase: 'idle' }
  return state
}

function reduceMoveFailed(
  state: StateIn<'moveFailed'>,
  event: BuildCustomNodesEvent
): BuildCustomNodesState {
  if (event.type === 'moveRefused') return { ...state, message: event.message }
  if (event.type !== 'moveRetried') return state
  return {
    phase: 'redeploying',
    session: { ...state.session, build: event.build },
    release: state.release
  }
}

function reducePhase(
  state: BuildCustomNodesState,
  event: BuildCustomNodesEvent
): BuildCustomNodesState {
  switch (state.phase) {
    case 'loading':
      return reduceLoading(state, event)
    case 'picking':
      return reducePicking(state, event)
    case 'reviewing':
      return reduceReviewing(state, event)
    case 'submitting':
      return reduceSubmitting(state, event)
    case 'building':
      return reduceBuilding(state, event)
    case 'buildFailed':
      return reduceBuildFailed(state, event)
    case 'redeploying':
      return reduceRedeploying(state, event)
    case 'moveFailed':
      return reduceMoveFailed(state, event)
    default:
      return state
  }
}

/** The next state of the Extensions node picker after `event`. */
export function reduceBuildCustomNodes(
  state: BuildCustomNodesState,
  event: BuildCustomNodesEvent
): BuildCustomNodesState {
  if (isRunning(state)) return reducePhase(state, event)
  if (event.type === 'opened')
    return {
      phase: 'loading',
      deploymentId: event.deploymentId,
      deploymentName: event.deploymentName
    }
  if (event.type === 'dismissed') return { phase: 'idle' }
  return reducePhase(state, event)
}
