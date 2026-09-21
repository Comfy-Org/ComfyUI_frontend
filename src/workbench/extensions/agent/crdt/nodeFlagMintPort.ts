/**
 * Write-back for durable node flags (`collapsed`, `pinned`), minted from the
 * nodeDataStore `setNodeFlags` command seam.
 *
 * The three existing ports cover createNode/deleteNode/clearGraph, links and
 * widgets; a scalar-field change on an EXISTING node had no mint path, while
 * the follower's reconcile unconditionally re-reads `flags` from the document
 * and reapplies it. That asymmetry is what silently reverts a local collapse.
 *
 * The frozen wire vocabulary has no node-field op, but `add_node` IS an LWW
 * upsert: the applier replaces an existing id's node map verbatim when the
 * incoming stamp wins, re-deriving link references from the live `links` map.
 * A re-mint of the node's current snapshot therefore carries the flag without
 * a protocol change — at the cost of a whole-node write (see the caveat on
 * {@link attachNodeFlagMintPort}).
 */
import type { NodeId, WorkflowNode } from '@comfyorg/comfy-multi-player'

import type { GraphOperation } from './graphOperations'
import { withoutGhostFlag } from './layoutMintPort'
import { shouldMint } from './mintGate'
import type { MintSession } from './mintSession'

interface NodeFlagChangeView {
  /** Owning (sub)graph uuid the command was scoped to. */
  graphId: string
  nodeId: NodeId
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
  /** Serialized workflow-JSON node for `id`, or null when unavailable. */
  serializeNode(id: string): WorkflowNode | null
  /** Receives minted semantic operations (the sender's inbox). */
  enqueue(operations: GraphOperation[]): void
}

export interface NodeFlagMintPort {
  detach(): void
}

/**
 * CAVEAT (prototype): the upsert carries the node's WHOLE snapshot, so it also
 * rewrites that node's widget values and clears its widget stamps. A flag
 * toggle concurrent with a remote widget write on the same node can therefore
 * lose the remote value. A narrow `set_node_field` op in the wire vocabulary
 * would remove that hazard; this port is the frontend half of that design.
 */
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
      // Subgraph-interior nodes have no root-scope `add_node` to upsert, so
      // the doc diverges from the local graph; observable, never silent (the
      // surfacing-honesty principle).
      console.error(
        '[agent-crdt] node-flag write-back outside the root graph has no wire op; the bound doc diverges from the local graph',
        `${change.graphId}:${String(change.nodeId)}`
      )
      return
    }

    const node = deps.serializeNode(String(change.nodeId))
    if (!node) {
      console.error(
        '[agent-crdt] node-flag write-back dropped: no snapshot for node',
        change.nodeId
      )
      return
    }

    deps.enqueue([
      {
        op: 'add_node',
        node_id: change.nodeId,
        class_type: node.type,
        pos: [...(node.pos ?? [0, 0])],
        node: withoutGhostFlag(node)
      }
    ])
  }

  return { detach: deps.events.onFlagsChanged(onFlagsChanged) }
}
