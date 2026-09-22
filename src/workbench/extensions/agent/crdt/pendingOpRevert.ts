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
import type { NodeId, Op } from '@comfyorg/comfy-multi-player'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
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

export type WithLayoutActor = <T>(actor: string, fn: () => T) => T

export type RevertableGraph = Pick<LGraph, '_nodes_by_id' | 'remove'>

export interface PendingRevertRemovalSeams {
  getGraph(): RevertableGraph | null
  withLayoutActor: WithLayoutActor
}

export interface PendingRevertNodeRegistry {
  onBatchMinted(ops: Op[]): void
  removeNode(opId: string, nodeId: NodeId): PendingRevertRemoval
  release(opIds: readonly string[]): void
}

export function createPendingRevertNodeRegistry(
  seams: PendingRevertRemovalSeams
): PendingRevertNodeRegistry {
  const targets = new Map<string, LGraphNode>()
  return {
    onBatchMinted(ops) {
      const graph = seams.getGraph()
      if (!graph) return
      for (const op of ops) {
        if (op.op !== 'add_node') continue
        const node = graph._nodes_by_id[toNodeId(op.node_id)]
        if (node) targets.set(op.op_id, node)
      }
    },
    removeNode(opId, nodeId) {
      const graph = seams.getGraph()
      if (!graph) return 'unavailable'
      const id = toNodeId(nodeId)
      const node = graph._nodes_by_id[id]
      if (!node || node !== targets.get(opId)) return 'missing'
      seams.withLayoutActor(PENDING_REVERT_ACTOR, () =>
        runMintPortsSuppressed(() => graph.remove(node))
      )
      return graph._nodes_by_id[id] === node ? 'refused' : 'removed'
    },
    release(opIds) {
      for (const opId of opIds) targets.delete(opId)
    }
  }
}

/**
 * @returns the node ids whose optimistic add was actually undone, so the
 * caller can tell the user "undone" only when it is true.
 */
export function applyPendingOpRevert(
  event: PendingOpTrackerEvent,
  registry: PendingRevertNodeRegistry
): NodeId[] {
  const removedNodeIds: NodeId[] = []
  if (event.type !== 'reverted') {
    if (
      event.type === 'cleared' ||
      event.type === 'skipped_cleared' ||
      event.type === 'reset'
    )
      registry.release(event.opIds)
    return removedNodeIds
  }
  for (const op of event.ops) {
    if (op.op !== 'add_node') continue
    const context = { opId: op.op_id, nodeId: String(op.node_id) }
    let removal: PendingRevertRemoval
    try {
      removal = registry.removeNode(op.op_id, op.node_id)
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
      registry.release(event.opIds)
      return removedNodeIds
    }
  }
  registry.release(event.opIds)
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
