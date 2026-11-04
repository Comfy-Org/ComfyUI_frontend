import type { NodeId, SuperGraphDocument } from './documentSchema'
import { planRuns, portHasContent } from './planRuns'
import type { NodeActivity, RunPlan, SuperComfyState } from './types'

export function activityOf(
  state: SuperComfyState,
  nodeId: NodeId
): NodeActivity {
  const { activity } = state.runtime
  return Object.hasOwn(activity, nodeId) ? activity[nodeId] : { phase: 'idle' }
}

export function nodeProgress(
  activity: NodeActivity
): { settled: number; failed: number; total: number } | null {
  if (activity.phase !== 'running') return null
  return {
    settled: activity.slots.filter(
      ({ state }) =>
        state === 'done' || state === 'cached' || state === 'failed'
    ).length,
    failed: activity.slots.filter(({ state }) => state === 'failed').length,
    total: activity.slots.length
  }
}

export function plannedRunCount(
  doc: SuperGraphDocument,
  nodeId: NodeId,
  runLimit: number
): RunPlan {
  return planRuns(doc, nodeId, { runLimit })
}

export function visibleMissingPorts(
  state: SuperComfyState,
  nodeId: NodeId
): string[] {
  const activity = activityOf(state, nodeId)
  if (activity.phase !== 'blocked') return []
  if (activity.block.reason !== 'missingInputs') return []
  return activity.block.ports.filter(
    (port) => !portHasContent(state.doc, nodeId, port)
  )
}
