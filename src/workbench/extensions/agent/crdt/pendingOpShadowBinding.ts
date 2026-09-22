/**
 * s3-opt-3 (KA-9 clear-on-effect / FEB-5): the one-way bridge from the
 * pending-op tracker's lifecycle events to the presentation shadow surface.
 *
 * The tracker (s3-opt-6) owns WHEN an op stops being pending — its effect
 * arrived in a `doc_update` (`cleared`), a projection covered a skipped
 * duplicate's ack seq (`skipped_cleared`), the host refused it (`reverted`),
 * or the doc lineage broke (`reset`). The shadow surface (s3-opt-5) owns
 * WHICH canvas entities render pending styling. This module translates the
 * former into the latter and nothing else:
 *
 * - `pending`          → `show(opId, targets)` per minted op
 * - `cleared`          → `clear(opId)`   (authoritative effect landed, KA-9)
 * - `skipped_cleared`  → `clear(opId)`   (authoritative projection covered it)
 * - `reverted`         → `revert(opId)`  (styling rolls back, s3-opt-2)
 * - `reset`            → `clearAll()`    (doc_reset / unmount / retarget, FEB-5)
 * - `delivery_unknown`, `skipped_awaiting` → nothing: the op is STILL pending
 *
 * A shadow is therefore never removed on an ack: the only clear paths are the
 * doc effect and the authoritative projection transition, exactly mirroring
 * the ledger. Shadows never touch Yjs (FORECLOSE #5).
 *
 * Target derivation is injected: wire ops carry graph-LOCAL ids and, for
 * interior writes, a subgraph instance `path`, while `ShadowTarget` needs the
 * owning graph uuid. {@link rootGraphTargetsForOp} is the first-pass resolver
 * for root-graph ops; interior (`path`-bearing) ops yield no targets until a
 * path-to-graph resolver exists, so they are tracked but unstyled.
 */
import type { Op } from '@comfyorg/comfy-multi-player'

import type { PendingOpShadowSurface, ShadowTarget } from './pendingOpShadow'
import type { PendingOpTrackerEvent } from './pendingOpTracker'

export type ShadowTargetsForOp = (op: Op) => readonly ShadowTarget[]

export interface PendingOpShadowBindingDeps {
  surface: PendingOpShadowSurface
  targetsForOp: ShadowTargetsForOp
}

/**
 * Returns the tracker `onEvent` tap that keeps `surface` in step with the
 * tracker. Pure dispatch: every branch is one surface verb.
 */
export function createPendingOpShadowBinding(
  deps: PendingOpShadowBindingDeps
): (event: PendingOpTrackerEvent) => void {
  const { surface, targetsForOp } = deps
  return (event) => {
    switch (event.type) {
      case 'pending':
        for (const op of event.ops) surface.show(op.op_id, targetsForOp(op))
        return
      case 'cleared':
      case 'skipped_cleared':
        for (const opId of event.opIds) surface.clear(opId)
        return
      case 'reverted':
        for (const opId of event.opIds) surface.revert(opId)
        return
      case 'reset':
        surface.clearAll()
        return
      case 'delivery_unknown':
      case 'skipped_awaiting':
        return
      default: {
        const unhandled: never = event
        return unhandled
      }
    }
  }
}

/** Interior ops address a subgraph instance path; the root graph cannot style them. */
function isInteriorOp(op: Op): boolean {
  return 'path' in op && Array.isArray(op.path) && op.path.length > 0
}

/**
 * Root-graph resolver: every graph-local id on the op becomes a target owned
 * by `rootGraphId()`. Returns no targets when no root graph is live or when
 * the op is interior to a subgraph instance.
 */
export function rootGraphTargetsForOp(
  rootGraphId: () => string | null
): ShadowTargetsForOp {
  return (op) => {
    const graphId = rootGraphId()
    if (graphId === null || isInteriorOp(op)) return []
    const node = (nodeId: unknown): ShadowTarget => ({
      kind: 'node',
      graphId,
      nodeId: String(nodeId)
    })
    switch (op.op) {
      case 'add_node':
      case 'delete_node':
        return [node(op.node_id)]
      case 'set_widget':
        return [
          {
            kind: 'widget',
            graphId,
            nodeId: String(op.node_id),
            widgetName: op.widget
          }
        ]
      case 'connect':
        return [
          { kind: 'link', graphId, linkId: String(op.link_id) },
          node(op.from_node),
          node(op.to_node)
        ]
      case 'disconnect':
        return [
          { kind: 'link', graphId, linkId: String(op.link_id) },
          node(op.to_node)
        ]
      case 'clear':
        return op.removed_nodes.map(node)
      case 'insert_workflow':
        return op.workflow.nodes.map((n) => node(n.id))
      case 'define_subgraph':
        return []
      default: {
        const unhandled: never = op
        return unhandled
      }
    }
  }
}
