/**
 * Write-back for durable node flags (`collapsed`, `pinned`), minted from the
 * nodeDataStore `setNodeFlags` command seam.
 *
 * The three original ports cover createNode/deleteNode/clearGraph, links and
 * widgets; a scalar-field change on an EXISTING node had no mint path, while
 * the follower's reconcile unconditionally re-reads `flags` from the document
 * and reapplies it. That asymmetry is what silently reverts a local collapse.
 *
 * Mints the wire vocabulary's `set_node_field` op (comfy-multi-player 0.3.3+),
 * a per-`(node, field)` LWW register. Earlier this port had to re-mint the
 * node's whole snapshot via `add_node`'s upsert semantics, because no
 * field-scoped op existed yet; that whole-node write also rewrote the node's
 * widgets_values and cleared its widget stamps, so a flag toggle concurrent
 * with a remote widget write on the same node could discard that write.
 * `set_node_field` claims only the addressed flag's register, so it commutes
 * with any concurrent write to a different register on the same node.
 */
import type { NodeId } from '@comfyorg/comfy-multi-player'

import { reportError } from '@/platform/telemetry/reportError'
import type { RootGraphId } from '@/types/graphScopeId'
import type { NodeFlagsPatch } from '@/types/nodeState'

import type { GraphOperation } from './graphOperations'
import { shouldMint } from './mintGate'
import type { MintSession } from './mintSession'

interface NodeFlagChangeView {
  /** Owning (sub)graph uuid the command was scoped to. */
  graphId: string
  nodeId: NodeId
  /** The flags actually written by the `setNodeFlags` call. */
  flags: NodeFlagsPatch
}

interface NodeFlagEventFeed {
  /** Fires after a `setNodeFlags` command that actually changed the node. */
  onFlagsChanged(listener: (change: NodeFlagChangeView) => void): () => void
}

export interface NodeFlagMintPortDeps {
  events: NodeFlagEventFeed
  session: MintSession
  /** Slice 00's product gate. */
  isEnabled(): boolean
  /** A semantic doc is bound for the active workflow. */
  isDocBound(): boolean
  /**
   * The bound workflow's own stored root graph id, or null when no workflow
   * is bound. Read from the workflow's serialized state rather than the live
   * canvas graph (mirrors the layout port's `boundRootGraphId`), so a flag
   * toggle that lands during a workflow switch - after `isDocBound()` already
   * reports the incoming workflow but before the shared canvas graph has
   * caught up - cannot mint into the wrong document.
   */
  boundRootGraphId(): RootGraphId | null
  /** Receives minted semantic operations (the sender's inbox). */
  enqueue(operations: GraphOperation[]): void
}

export interface NodeFlagMintPort {
  detach(): void
}

/** The `set_node_field` field each `NodeFlagsPatch` key addresses. */
function fieldForFlag(
  flag: keyof NodeFlagsPatch
): 'flags.collapsed' | 'flags.pinned' {
  return flag === 'collapsed' ? 'flags.collapsed' : 'flags.pinned'
}

/**
 * `pin(false)` patches `{ pinned: undefined }` (falsy-collapses to
 * `undefined` at the call site), so the field's absent/default state is
 * carried as `false` here rather than as the op's `null` (a `null` value
 * deletes the field; `false` is an equally valid explicit write and matches
 * what `INodeFlags` already reads back as `!!flags.pinned`).
 */
function flagOps(nodeId: NodeId, flags: NodeFlagsPatch): GraphOperation[] {
  return (Object.keys(flags) as (keyof NodeFlagsPatch)[]).map((flag) => ({
    op: 'set_node_field' as const,
    node_id: nodeId,
    field: fieldForFlag(flag),
    value: flags[flag] ?? false
  }))
}

export function attachNodeFlagMintPort(
  deps: NodeFlagMintPortDeps
): NodeFlagMintPort {
  const reportedUnboundGraphChanges = new Set<string>()

  /**
   * Reports (deduped per tick, like the layout port's own
   * `reportOpForUnboundGraph`) and returns true when `change` targets a
   * graph other than the bound document's root - either a subgraph-interior
   * node (no `set_node_field` addressing for a non-root graph) or a foreign
   * workflow caught mid-switch. A null `boundRootGraphId` means scope cannot
   * be judged yet (untracked, not restricted - matches the layout port).
   */
  function reportForeignGraphChange(change: NodeFlagChangeView): boolean {
    const boundRootGraphId = deps.boundRootGraphId()
    if (boundRootGraphId === null || change.graphId === boundRootGraphId)
      return false

    const reportKey = `${change.graphId}:${boundRootGraphId}`
    if (reportedUnboundGraphChanges.has(reportKey)) return true

    reportedUnboundGraphChanges.add(reportKey)
    queueMicrotask(() => reportedUnboundGraphChanges.delete(reportKey))
    reportError(
      new Error(
        `setNodeFlags targets graph ${change.graphId}, not the bound document's root graph ${boundRootGraphId}; refusing to mint (no set_node_field addressing for a non-root graph)`
      ),
      {
        errorType: 'agent_crdt_op_for_unbound_graph',
        context: {
          graphId: change.graphId,
          boundRootGraphId,
          nodeId: change.nodeId
        }
      }
    )
    return true
  }

  function onFlagsChanged(change: NodeFlagChangeView): void {
    const mintable = shouldMint({
      flagEnabled: deps.isEnabled(),
      docBound: deps.isDocBound(),
      teardown: deps.session.inTeardown()
    })
    if (!mintable) return
    if (reportForeignGraphChange(change)) return

    deps.enqueue(flagOps(change.nodeId, change.flags))
  }

  return { detach: deps.events.onFlagsChanged(onFlagsChanged) }
}
