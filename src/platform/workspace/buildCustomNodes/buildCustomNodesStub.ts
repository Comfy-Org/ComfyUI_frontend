import type {
  BuildCustomNode,
  DeploymentBuild,
  ReleaseBuild,
  ReleaseMove,
  SavedCustomNodes,
  ServiceOutcome,
  StartedRelease
} from '@/platform/workspace/buildCustomNodes/buildCustomNodesTypes'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'
import { getSessionOverride } from '@/utils/sessionFeatureFlagOverride'

const STUB_SCENARIO_FLAG = 'build_custom_nodes_stub'
const STUB_LATENCY_MS = 250
const BUILD_PHASES = ['freeze', 'assemble', 'validate', 'hash', 'bake']
const FAILING_PHASE_INDEX = 1
const MOVE_POLLS_BEFORE_LANDING = 3

type StubScenario = 'success' | 'buildFails' | 'viewer'

interface StubRelease {
  release_id: string
  version: number
  polls: number
  fails: boolean
  failingPack: string
  startedAt: number
}

interface StubDeployment {
  revision: number
  releaseId: string
  releaseVersion: number
  buildId: string
  buildName: string
  updatedAt: string
  customNodes: BuildCustomNode[]
  releases: Map<string, StubRelease>
  failedOnce: boolean
  pendingMove: { releaseId: string; polls: number; since: string } | null
}

const STUB_CUSTOM_NODES: BuildCustomNode[] = [
  {
    name: 'ComfyUI-KJNodes',
    id: 'comfyui-kjnodes',
    repository: 'https://github.com/kijai/ComfyUI-KJNodes',
    commit: '5e1b0c2a9f4d7e3b8c6a1d2f0e9b7c5a3d1f8e6b'
  },
  { name: 'rgthree-comfy', id: 'rgthree-comfy', registryVersion: '1.0.2' },
  {
    name: 'ComfyUI-VideoHelperSuite',
    id: 'comfyui-videohelpersuite',
    registryVersion: '1.7.9'
  }
]

const deployments = new Map<string, StubDeployment>()

function stubScenario(): StubScenario {
  const value =
    getSessionOverride<unknown>(STUB_SCENARIO_FLAG) ??
    getDevOverride<unknown>(STUB_SCENARIO_FLAG)
  return value === 'buildFails' || value === 'viewer' ? value : 'success'
}

function answerLater<T>(value: T): Promise<ServiceOutcome<T>> {
  return new Promise((resolve) =>
    setTimeout(() => resolve({ ok: true, value }), STUB_LATENCY_MS)
  )
}

function refuseLater<T>(
  code: string,
  message: string
): Promise<ServiceOutcome<T>> {
  return new Promise((resolve) =>
    setTimeout(() => resolve({ ok: false, code, message }), STUB_LATENCY_MS)
  )
}

function deploymentFor(deploymentId: string): StubDeployment | null {
  const known = deployments.get(deploymentId)
  if (known) return known
  const row = useDeploymentPickStore().deployments.find(
    (deployment) => deployment.deployment_id === deploymentId
  )
  if (!row?.build_id) return null
  const created: StubDeployment = {
    revision: 1,
    releaseId: row.release_id,
    releaseVersion: row.release_version ?? 1,
    buildId: row.build_id,
    buildName: row.build_name ?? row.build_id,
    updatedAt: new Date().toISOString(),
    customNodes: STUB_CUSTOM_NODES,
    releases: new Map(),
    failedOnce: false,
    pendingMove: null
  }
  deployments.set(deploymentId, created)
  return created
}

function nextReleaseVersion(deployment: StubDeployment): number {
  const versions = [...deployment.releases.values()].map(
    (release) => release.version
  )
  return Math.max(deployment.releaseVersion, ...versions) + 1
}

function releaseView(release: StubRelease): ReleaseBuild {
  const reached = Math.min(release.polls, BUILD_PHASES.length + 1)
  const failedAt = release.fails ? FAILING_PHASE_INDEX + 1 : Infinity
  const phases = BUILD_PHASES.slice(0, Math.min(reached, failedAt))
  const timeline = phases.map((phase, index) => ({
    phase,
    level: index + 1 === failedAt ? ('error' as const) : ('info' as const),
    message: phase,
    at: new Date(release.startedAt + index * 1000).toISOString()
  }))
  const base = {
    release_id: release.release_id,
    version: release.version,
    timeline
  }
  if (reached >= failedAt) {
    return {
      ...base,
      status: 'complete',
      deployable: false,
      target: {
        status: 'failed',
        failure_reason: `ERROR: Cannot install ${release.failingPack} because these package versions have conflicting dependencies.\n    ultralytics 8.3.40 depends on numpy<2.0.0\n    The Build pins numpy==2.1.3`
      }
    }
  }
  if (reached > BUILD_PHASES.length) {
    return {
      ...base,
      status: 'complete',
      deployable: true,
      target: { status: 'ready' }
    }
  }
  return {
    ...base,
    status: reached === 0 ? 'queued' : 'building',
    deployable: false,
    target: { status: reached === 0 ? 'queued' : 'building' }
  }
}

function landPendingMove(deployment: StubDeployment) {
  const move = deployment.pendingMove
  if (!move) return
  if (move.polls < MOVE_POLLS_BEFORE_LANDING) {
    deployment.pendingMove = { ...move, polls: move.polls + 1 }
    return
  }
  const landed = deployment.releases.get(move.releaseId)
  deployment.pendingMove = null
  deployment.revision += 1
  deployment.releaseId = move.releaseId
  deployment.releaseVersion = landed?.version ?? deployment.releaseVersion
}

function buildView(deployment: StubDeployment): DeploymentBuild {
  const move = deployment.pendingMove
  return {
    revision: deployment.revision,
    pending_update: move
      ? { release_id: move.releaseId, status: 'starting', since: move.since }
      : null,
    release: {
      release_id: deployment.releaseId,
      version: deployment.releaseVersion
    },
    build: {
      build_id: deployment.buildId,
      name: deployment.buildName,
      updated_at: deployment.updatedAt,
      custom_nodes: deployment.customNodes
    },
    can_change_build: stubScenario() !== 'viewer'
  }
}

/**
 * Stands in for the ingest routes in proposals/dplat-3807-backend.md until
 * they ship. `?ff=build_custom_nodes_stub:buildFails` or `:viewer` picks a
 * scenario.
 */
export const buildCustomNodesStub = {
  getDeploymentBuild(
    deploymentId: string
  ): Promise<ServiceOutcome<DeploymentBuild>> {
    const deployment = deploymentFor(deploymentId)
    if (!deployment)
      return refuseLater('build_unknown', 'This deployment has no Build.')
    landPendingMove(deployment)
    return answerLater(buildView(deployment))
  },

  saveCustomNodes(
    deploymentId: string,
    expectedUpdatedAt: string,
    customNodes: BuildCustomNode[]
  ): Promise<ServiceOutcome<SavedCustomNodes>> {
    const deployment = deploymentFor(deploymentId)
    if (!deployment)
      return refuseLater('build_unknown', 'This deployment has no Build.')
    if (deployment.updatedAt !== expectedUpdatedAt)
      return refuseLater(
        'build_changed',
        'Someone else changed this Build. Reopen Extensions to see their change.'
      )
    deployment.customNodes = customNodes
    deployment.updatedAt = new Date(
      Date.parse(deployment.updatedAt) + 1000
    ).toISOString()
    return answerLater({ updated_at: deployment.updatedAt })
  },

  startRelease(deploymentId: string): Promise<ServiceOutcome<StartedRelease>> {
    const deployment = deploymentFor(deploymentId)
    if (!deployment)
      return refuseLater('build_unknown', 'This deployment has no Build.')
    const fails = stubScenario() === 'buildFails' && !deployment.failedOnce
    if (fails) deployment.failedOnce = true
    const release: StubRelease = {
      release_id: `rel-stub-${deployment.releases.size + 1}`,
      version: nextReleaseVersion(deployment),
      polls: 0,
      fails,
      failingPack: deployment.customNodes.at(-1)?.name ?? 'a node pack',
      startedAt: Date.now()
    }
    deployment.releases.set(release.release_id, release)
    return answerLater({
      release_id: release.release_id,
      version: release.version
    })
  },

  getRelease(
    deploymentId: string,
    releaseId: string
  ): Promise<ServiceOutcome<ReleaseBuild>> {
    const release = deploymentFor(deploymentId)?.releases.get(releaseId)
    if (!release) return refuseLater('not_found', 'This Release is not known.')
    release.polls += 1
    return answerLater(releaseView(release))
  },

  getReleaseLog(
    deploymentId: string,
    releaseId: string
  ): Promise<ServiceOutcome<string>> {
    const release = deploymentFor(deploymentId)?.releases.get(releaseId)
    if (!release) return refuseLater('not_found', 'This Release is not known.')
    const view = releaseView(release)
    const lines = view.timeline.map((entry) => `[${entry.at}] ${entry.phase}`)
    if (view.target.failure_reason) lines.push(view.target.failure_reason)
    return answerLater(lines.join('\n'))
  },

  moveToRelease(
    deploymentId: string,
    releaseId: string,
    baseRevision: number
  ): Promise<ServiceOutcome<ReleaseMove>> {
    const deployment = deploymentFor(deploymentId)
    if (!deployment)
      return refuseLater('build_unknown', 'This deployment has no Build.')
    if (deployment.revision !== baseRevision)
      return refuseLater(
        'STALE_REVISION',
        'This deployment changed since you opened Extensions.'
      )
    deployment.pendingMove = {
      releaseId,
      polls: 0,
      since: new Date().toISOString()
    }
    return answerLater({
      revision: deployment.revision,
      release_id: deployment.releaseId,
      pending_update: {
        release_id: releaseId,
        status: 'starting',
        since: deployment.pendingMove.since
      }
    })
  }
}
