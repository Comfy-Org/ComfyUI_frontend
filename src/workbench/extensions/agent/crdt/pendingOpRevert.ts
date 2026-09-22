/**
 * Consumes the tracker's `reverted` events to undo the optimistic canvas
 * effect of ops the host never accepted (ADR-CRDT-PENDING-0030). First pass:
 * a reverted `add_node` removes its node. The removal must stay invisible to
 * the mint ports — `LGraph.remove` ends in an actor-less layout `deleteNode`
 * delivered on a microtask, AFTER `runMintPortsSuppressed`'s bracket has
 * ended, so only the injected `withLayoutActor` (the layout store's
 * apply-time actor stamping) keeps that deferred delivery from re-minting a
 * `delete_node` for a node the host never had.
 */
import type { NodeId } from '@comfyorg/comfy-multi-player'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import { reportError } from '@/platform/telemetry/reportError'
import { toNodeId } from '@/types/nodeId'

import { runMintPortsSuppressed } from './mintPortWiring'
import type { PendingOpTrackerEvent } from './pendingOpTracker'

export const PENDING_REVERT_ACTOR = 'agent-pending-revert'

export type PendingRevertRemoval =
  | 'removed'
  | 'missing'
  | 'refused'
  | 'unavailable'

export type PendingRevertRemoveNode = (nodeId: NodeId) => PendingRevertRemoval

export type WithLayoutActor = <T>(actor: string, fn: () => T) => T

export type RevertableGraph = Pick<LGraph, '_nodes_by_id' | 'remove'>

export interface PendingRevertRemovalSeams {
  /** The live root graph, or null when no workflow is open. */
  getGraph(): RevertableGraph | null
  /** `layoutStore.withActor`, injected by the composition root. */
  withLayoutActor: WithLayoutActor
}

export function createPendingRevertRemoveNode(
  seams: PendingRevertRemovalSeams
): PendingRevertRemoveNode {
  return (nodeId) => {
    const graph = seams.getGraph()
    if (!graph) return 'unavailable'
    const id = toNodeId(nodeId)
    const node = graph._nodes_by_id[id]
    if (!node) return 'missing'
    seams.withLayoutActor(PENDING_REVERT_ACTOR, () =>
      runMintPortsSuppressed(() => graph.remove(node))
    )
    return graph._nodes_by_id[id] === node ? 'refused' : 'removed'
  }
}

/**
 * @returns the node ids whose optimistic add was actually undone, so the
 * caller can tell the user "undone" only when it is true.
 */
export function applyPendingOpRevert(
  event: PendingOpTrackerEvent,
  removeNode: PendingRevertRemoveNode
): NodeId[] {
  const removedNodeIds: NodeId[] = []
  if (event.type !== 'reverted') return removedNodeIds
  for (const op of event.ops) {
    if (op.op !== 'add_node') continue
    const context = { opId: op.op_id, nodeId: String(op.node_id) }
    let removal: PendingRevertRemoval
    try {
      removal = removeNode(op.node_id)
    } catch (error) {
      reportError(error, {
        errorType: 'agent_crdt_pending_revert_remove_failed',
        context
      })
      continue
    }
    if (removal === 'removed') {
      removedNodeIds.push(op.node_id)
    } else if (removal === 'refused') {
      reportError(new Error('Pending revert removal was refused'), {
        errorType: 'agent_crdt_pending_revert_remove_refused',
        context
      })
    } else if (removal === 'unavailable') {
      reportError(new Error('Pending revert found no live graph'), {
        errorType: 'agent_crdt_pending_revert_graph_unavailable',
        context
      })
      return removedNodeIds
    }
  }
  return removedNodeIds
}

/**
 * One settle can emit two `reverted` events (failed + unprocessed), so the
 * user-facing notification coalesces per microtask into a single call.
 */
export function createRevertNotifier(
  notify: (undone: boolean) => void
): (event: PendingOpTrackerEvent, removedNodeIds: NodeId[]) => void {
  let pending: { undone: boolean } | null = null
  return (event, removedNodeIds) => {
    if (event.type !== 'reverted') return
    if (pending === null) {
      const flush = { undone: false }
      pending = flush
      queueMicrotask(() => {
        pending = null
        notify(flush.undone)
      })
    }
    const couldHaveUndoneAnAdd = event.ops.some((op) => op.op === 'add_node')
    if (couldHaveUndoneAnAdd && removedNodeIds.length > 0) pending.undone = true
  }
}
