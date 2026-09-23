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
  /** The active root graph id, or null when no workflow is open. */
  rootGraphId(): string | null
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
  function onFlagsChanged(change: NodeFlagChangeView): void {
    const mintable = shouldMint({
      flagEnabled: deps.isEnabled(),
      docBound: deps.isDocBound(),
      teardown: deps.session.inTeardown()
    })
    if (!mintable) return

    const root = deps.rootGraphId()
    if (root === null || change.graphId !== root) {
      // Subgraph-interior nodes have no root-scope `set_node_field` target
      // (the op addresses by node_id alone, unlike `set_widget`'s interior
      // path form), so the doc diverges from the local graph; observable,
      // never silent (the surfacing-honesty principle).
      console.error(
        '[agent-crdt] node-flag write-back outside the root graph has no wire op; the bound doc diverges from the local graph',
        `${change.graphId}:${String(change.nodeId)}`
      )
      return
    }

    deps.enqueue(flagOps(change.nodeId, change.flags))
  }

  return { detach: deps.events.onFlagsChanged(onFlagsChanged) }
}
