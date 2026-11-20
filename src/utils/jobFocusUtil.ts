import type {
  JobId,
  NodeProgressState
} from '@comfyorg/api-client/executionTypes'

export function pickNextFocusedJob(
  startedOldestFirst: readonly JobId[],
  isOwnedByActiveWorkflow: (jobId: JobId) => boolean
): JobId | null {
  return (
    startedOldestFirst.findLast((jobId) => isOwnedByActiveWorkflow(jobId)) ??
    startedOldestFirst.at(-1) ??
    null
  )
}

export function jobProgressFraction(
  queuedNodesDone: readonly boolean[],
  nodeStates: readonly Pick<NodeProgressState, 'state'>[]
): number {
  if (queuedNodesDone.length > 0)
    return queuedNodesDone.filter(Boolean).length / queuedNodesDone.length
  if (nodeStates.length === 0) return 0
  return (
    nodeStates.filter((n) => n.state === 'finished').length / nodeStates.length
  )
}
