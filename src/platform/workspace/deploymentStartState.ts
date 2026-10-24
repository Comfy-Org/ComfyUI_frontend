import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'

/** Why the server would not start a deployment, or why it did not come up. */
export type DeploymentStartRefusal =
  | 'noCredits'
  | 'tooManyRunning'
  | 'notAllowed'
  | 'unavailable'
  | 'failed'

/** What asking the server to start a deployment did. */
export type DeploymentStartOutcome =
  | { ok: true }
  | { ok: false; reason: DeploymentStartRefusal; message: string | null }

/**
 * A Start this page asked for: `requested` while the request is in flight,
 * `accepted` once the server took it (`seenStarting` after a listing showed
 * it on its way), `refused` with the server's reason.
 */
export type DeploymentStart =
  | { phase: 'requested' }
  | { phase: 'accepted'; seenStarting: boolean }
  | { phase: 'refused'; reason: DeploymentStartRefusal; message: string | null }

/** The Starts this page asked for, by deployment id. */
export type DeploymentStarts = ReadonlyMap<string, DeploymentStart>

export type DeploymentStartEvent =
  | { type: 'requested'; deploymentId: string }
  | {
      type: 'answered'
      deploymentId: string
      outcome: DeploymentStartOutcome
    }
  | { type: 'listed'; deployments: readonly WorkspaceDeployment[] }

/** What choosing a deployment's row does. */
export type DeploymentRowAction = 'pick' | 'start' | 'retry' | 'none'

const STARTING_STATUSES = new Set(['queued', 'provisioning', 'starting'])
const STARTABLE_STATUSES = new Set(['stopped', 'failed'])

function afterListing(
  start: DeploymentStart,
  status: string
): DeploymentStart | null {
  if (status === 'ready') return null
  if (start.phase !== 'accepted') return start
  if (STARTING_STATUSES.has(status)) return { ...start, seenStarting: true }
  if (start.seenStarting && STARTABLE_STATUSES.has(status)) {
    return { phase: 'refused', reason: 'failed', message: null }
  }
  return start
}

function listed(
  starts: DeploymentStarts,
  deployments: readonly WorkspaceDeployment[]
): DeploymentStarts {
  const next = new Map<string, DeploymentStart>()
  for (const [deploymentId, start] of starts) {
    const deployment = deployments.find((d) => d.deployment_id === deploymentId)
    if (!deployment) continue
    const updated = afterListing(start, deployment.status)
    if (updated) next.set(deploymentId, updated)
  }
  return next
}

export function reduceDeploymentStarts(
  starts: DeploymentStarts,
  event: DeploymentStartEvent
): DeploymentStarts {
  switch (event.type) {
    case 'requested': {
      const current = starts.get(event.deploymentId)
      if (current && current.phase !== 'refused') return starts
      return new Map(starts).set(event.deploymentId, { phase: 'requested' })
    }
    case 'answered': {
      if (starts.get(event.deploymentId)?.phase !== 'requested') return starts
      const { outcome } = event
      return new Map(starts).set(
        event.deploymentId,
        outcome.ok
          ? { phase: 'accepted', seenStarting: false }
          : {
              phase: 'refused',
              reason: outcome.reason,
              message: outcome.message
            }
      )
    }
    case 'listed':
      return listed(starts, event.deployments)
  }
}

const FINAL_REFUSALS = new Set<DeploymentStartRefusal>([
  'notAllowed',
  'unavailable'
])

/**
 * What choosing a row does: only a ready deployment is picked. A stopped or
 * failed one is started when Start is offered, and a refused Start is retried
 * unless retrying cannot help.
 */
export function deploymentRowAction(
  status: string,
  start: DeploymentStart | undefined,
  { startOffered }: { startOffered: boolean }
): DeploymentRowAction {
  if (start?.phase === 'refused') {
    return FINAL_REFUSALS.has(start.reason) ? 'none' : 'retry'
  }
  if (start) return 'none'
  if (status === 'ready') return 'pick'
  return startOffered && STARTABLE_STATUSES.has(status) ? 'start' : 'none'
}

/** Why a row cannot be picked, when the row itself does not already say. */
export type DeploymentRowReason =
  | 'stopped'
  | 'failed'
  | 'starting'
  | 'startElsewhere'
  | 'notAllowed'
  | 'notReady'

export function deploymentRowReason(
  status: string,
  action: DeploymentRowAction,
  start: DeploymentStart | undefined
): DeploymentRowReason | null {
  if (start?.phase === 'refused') {
    return start.reason === 'notAllowed' ? 'notAllowed' : null
  }
  if (action === 'pick') return null
  if (start || STARTING_STATUSES.has(status)) return 'starting'
  if (action === 'start') return status === 'failed' ? 'failed' : 'stopped'
  return STARTABLE_STATUSES.has(status) ? 'startElsewhere' : 'notReady'
}
