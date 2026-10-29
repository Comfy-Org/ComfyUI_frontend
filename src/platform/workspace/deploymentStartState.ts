import { pendingServerFact } from '@/platform/serverFacts/pendingServerFact'
import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
import { deploymentStatusTone } from '@/platform/workspace/composables/useDeploymentLabels'

/** Why the server would not start a deployment. */
export type DeploymentStartRefusal =
  | 'noCredits'
  | 'tooManyRunning'
  | 'unavailable'
  | 'failed'

/**
 * A Start this page asked for, until the listing after it lands, or the
 * server's refusal of it.
 */
export type DeploymentStart =
  | { phase: 'requested' }
  | { phase: 'refused'; reason: DeploymentStartRefusal; message: string | null }

/** The Starts this page asked for, by deployment id. */
export type DeploymentStarts = ReadonlyMap<string, DeploymentStart>

export type DeploymentStartEvent =
  | { type: 'requested'; deploymentId: string }
  | { type: 'taken'; deploymentId: string }
  | {
      type: 'refused'
      deploymentId: string
      reason: DeploymentStartRefusal
      message: string | null
    }
  | { type: 'listed'; deployments: readonly WorkspaceDeployment[] }

/** What choosing a deployment's row does. */
export type DeploymentRowAction = 'pick' | 'start' | 'retry' | 'open' | 'none'

function withoutStart(
  starts: DeploymentStarts,
  deploymentId: string
): DeploymentStarts {
  const next = new Map(starts)
  next.delete(deploymentId)
  return next
}

function lastsThrough(
  start: DeploymentStart,
  deployment: WorkspaceDeployment
): boolean {
  if (start.phase === 'requested') return true
  return deployment.can_start
}

function listed(
  starts: DeploymentStarts,
  deployments: readonly WorkspaceDeployment[]
): DeploymentStarts {
  const next = new Map<string, DeploymentStart>()
  for (const [deploymentId, start] of starts) {
    const deployment = deployments.find((d) => d.deployment_id === deploymentId)
    if (deployment && lastsThrough(start, deployment)) {
      next.set(deploymentId, start)
    }
  }
  return next
}

export function reduceDeploymentStarts(
  starts: DeploymentStarts,
  event: DeploymentStartEvent
): DeploymentStarts {
  switch (event.type) {
    case 'requested':
      if (starts.get(event.deploymentId)?.phase === 'requested') return starts
      return new Map(starts).set(event.deploymentId, { phase: 'requested' })
    case 'taken':
      if (starts.get(event.deploymentId)?.phase !== 'requested') return starts
      return withoutStart(starts, event.deploymentId)
    case 'refused':
      if (starts.get(event.deploymentId)?.phase !== 'requested') return starts
      return new Map(starts).set(event.deploymentId, {
        phase: 'refused',
        reason: event.reason,
        message: event.message
      })
    case 'listed':
      return listed(starts, event.deployments)
  }
}

/**
 * Picks a ready row, starts one the listing says can start (or opens it on the
 * Developer Platform while Start is not offered), and retries a refused Start.
 */
export function deploymentRowAction(
  deployment: WorkspaceDeployment,
  start: DeploymentStart | undefined,
  { startOffered }: { startOffered: boolean }
): DeploymentRowAction {
  if (start?.phase === 'requested') return 'none'
  if (start?.phase === 'refused') {
    return start.reason === 'unavailable' || !startOffered ? 'open' : 'retry'
  }
  if (pendingServerFact('BE-24332', deployment.status === 'ready'))
    return 'pick'
  if (!deployment.can_start) return 'none'
  return startOffered ? 'start' : 'open'
}

/** Why a row cannot be picked, when the row itself does not already say. */
export type DeploymentRowReason =
  | 'stopped'
  | 'failed'
  | 'starting'
  | 'startElsewhere'
  | 'notReady'

export function deploymentRowReason(
  deployment: WorkspaceDeployment,
  action: DeploymentRowAction,
  start: DeploymentStart | undefined
): DeploymentRowReason | null {
  if (start?.phase === 'refused' || action === 'pick') return null
  if (start || deploymentStatusTone(deployment.status) === 'pending') {
    return 'starting'
  }
  if (action === 'start') {
    return deployment.status === 'failed' ? 'failed' : 'stopped'
  }
  return action === 'open' ? 'startElsewhere' : 'notReady'
}
