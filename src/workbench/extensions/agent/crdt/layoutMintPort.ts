/**
 * Layout-store mint port over the injected change feed (both applyOperation
 * entries funnel through it). Provenance rides each operation's source and
 * actor, so deferred delivery still carries it; remote applies never re-mint
 * (KA-6). Teardown clears are inert
 * outside runIntentionalClear, whose capture is the authoritative pre-clear
 * node set; delete_node consumes the link port's severance capture.
 */
import type { NodeId, WorkflowNode } from '@comfyorg/comfy-multi-player'

import { reportError } from '@/platform/telemetry/reportError'

import type { GraphOperation } from './graphOperations'
import type { SeveranceLog } from './linkMintPort'
import { shouldMint } from './mintGate'
import type { MintSession } from './mintSession'

/**
 * The structural slice of the layout store's LayoutChange this port reads.
 * Structural on purpose: the real feed passes the store's own change objects
 * through without this module importing renderer types.
 */
export interface LayoutChangeView {
  operation: {
    type: string
    graphId?: string
    ownerGraphId?: string
    actor?: string
    source?: string
    nodeId?: NodeId
    layout?: { position: { x: number; y: number } }
  }
}

interface LayoutChangeFeed {
  onChange(listener: (change: LayoutChangeView) => void): () => void
}

/** The workflow-JSON node snapshot an `add_node` carries, read at mint time. */
interface MintSnapshotSource {
  /** Serialized workflow-JSON node for `id`, or null when unavailable. */
  serializeNode(id: string): WorkflowNode | null
  /** Every node id currently on the graph (clear's authoritative target set). */
  nodeIds(): NodeId[]
}

export interface LayoutMintPortDeps {
  changes: LayoutChangeFeed
  /** Shared teardown brackets (held by the load path around every graph load). */
  session: MintSession
  /** The link port's capture of a deleted node's severed link ids. */
  severedLinks: SeveranceLog
  /** The session's local layout-actor prefix (`ACTOR_CONFIG.USER_PREFIX`). */
  localActorPrefix: string
  /** Slice 00's product gate. */
  isEnabled(): boolean
  /** A semantic doc is bound for the active workflow. */
  isDocBound(): boolean
  source: MintSnapshotSource
  /** Receives minted semantic operations (the sender's inbox). */
  enqueue(operations: GraphOperation[]): void
}

export interface LayoutMintPort {
  /**
   * Marks `fn`'s clear as an intentional human clear: captures the
   * authoritative pre-clear node set and mints ONE `clear` op when the
   * store's clearGraph change arrives from a local actor.
   */
  runIntentionalClear<T>(fn: () => T): T
  detach(): void
}

/**
 * A node minted mid-placement still carries `flags.ghost`, because `LGraph.add`
 * sets it before the layout change that mints `add_node`. The document must not
 * record it: the placement click clears the flag locally and mints no op, so the
 * document's copy would outlive the placement it describes.
 */
function withoutGhostFlag(node: WorkflowNode): WorkflowNode {
  if (node.flags?.ghost === undefined) return node
  const { ghost: _ghost, ...flags } = node.flags
  return { ...node, flags }
}

export function attachLayoutMintPort(deps: LayoutMintPortDeps): LayoutMintPort {
  let intentionalClearNodes: NodeId[] | null = null
  const reportedInteriorChanges = new Set<string>()
  // Ids this port has itself minted an add_node for, and that the local
  // document has not since lost (by any deleteNode or clearGraph change,
  // whether or not that change itself went on to mint an op). Deliberately
  // NOT seeded from `deps.source.nodeIds()`: that snapshot already includes
  // a node the moment its own createNode change fires (the live graph
  // mutates before the change event reaches this port), so checking it at
  // mint time would reject every genuine create. This set instead answers
  // "did *this port* already relay an add for this id, and does the
  // document still hold that id" — the shape of a redo that recreates an
  // already-doc-known node under its original id (the node id_collision
  // replay storm in agentCrdtProjection debug reports) without falsely
  // suppressing a genuine recreate after a real (possibly remote or
  // teardown) removal.
  const mintedNodeIds = new Set<string>()

  function gate(change: LayoutChangeView, teardown: boolean): boolean {
    const actor = change.operation.actor
    return (
      change.operation.source !== 'agent-remote' &&
      actor?.startsWith(deps.localActorPrefix) === true &&
      shouldMint({
        flagEnabled: deps.isEnabled(),
        docBound: deps.isDocBound(),
        teardown
      })
    )
  }

  function reportUnrepresentableInteriorChange(
    operation: LayoutChangeView['operation'],
    action: 'create' | 'delete'
  ): boolean {
    if (operation.graphId === undefined) return false

    if (operation.ownerGraphId === undefined) {
      // Every production emitter (canvas attach/detach, the agent panel) now
      // sets ownerGraphId on every createNode/deleteNode it mints, root scope
      // included (ownerGraphId === graphId there). A defined graphId with no
      // ownerGraphId means an emitter regressed the contract, not a benign
      // root edit — fail closed instead of silently minting a root op that
      // may really belong to a subgraph (the #16503 class of bug).
      reportError(
        new Error(
          `${action}Node has no ownerGraphId; refusing to mint (root-vs-subgraph is unknown)`
        ),
        {
          errorType: `agent_crdt_missing_owner_graph_id_${action}`,
          context: { graphId: operation.graphId, nodeId: operation.nodeId }
        }
      )
      return true
    }

    if (operation.ownerGraphId === operation.graphId) return false

    const reportKey = `${action}:${operation.graphId}:${operation.ownerGraphId}`
    if (reportedInteriorChanges.has(reportKey)) return true

    reportedInteriorChanges.add(reportKey)
    queueMicrotask(() => reportedInteriorChanges.delete(reportKey))
    reportError(
      new Error(
        `Subgraph-interior node ${action} has no wire op; the bound doc diverges from the local graph`
      ),
      {
        errorType: `agent_crdt_unrepresentable_subgraph_node_${action}`,
        context: {
          graphId: operation.graphId,
          ownerGraphId: operation.ownerGraphId,
          nodeId: operation.nodeId
        }
      }
    )
    return true
  }

  function onChange(change: LayoutChangeView): void {
    const operation = change.operation
    const inTeardown = deps.session.inTeardown()
    switch (operation.type) {
      case 'createNode': {
        if (!gate(change, inTeardown)) return
        if (reportUnrepresentableInteriorChange(operation, 'create')) return
        if (operation.nodeId === undefined || !operation.layout) return
        const nodeIdKey = String(operation.nodeId)
        if (mintedNodeIds.has(nodeIdKey)) return
        const node = deps.source.serializeNode(nodeIdKey)
        if (!node) {
          // A dropped human mint is a local-graph-vs-doc divergence; it must
          // be observable, never silent (the surfacing-honesty principle).
          console.error(
            '[agent-crdt] add_node mint dropped: no snapshot for node',
            operation.nodeId
          )
          return
        }
        deps.enqueue([
          {
            op: 'add_node',
            node_id: operation.nodeId,
            class_type: node.type,
            pos: [operation.layout.position.x, operation.layout.position.y],
            node: withoutGhostFlag(node)
          }
        ])
        mintedNodeIds.add(nodeIdKey)
        return
      }
      case 'deleteNode': {
        // The document lost this id the moment a deleteNode change fired,
        // regardless of whether this port also gates the delete_node op for
        // echo-suppression or teardown - the two questions are independent
        // (see the leading comment on `mintedNodeIds`).
        if (operation.nodeId === undefined) return
        mintedNodeIds.delete(String(operation.nodeId))
        if (!gate(change, inTeardown)) return
        if (reportUnrepresentableInteriorChange(operation, 'delete')) return
        deps.enqueue([
          {
            op: 'delete_node',
            node_id: operation.nodeId,
            removed_links: deps.severedLinks.take(String(operation.nodeId))
          }
        ])
        return
      }
      case 'clearGraph': {
        const captured = intentionalClearNodes
        intentionalClearNodes = null
        mintedNodeIds.clear()
        if (!gate(change, inTeardown || captured === null)) return
        deps.enqueue([{ op: 'clear', removed_nodes: captured ?? [] }])
        return
      }
      default:
        return
    }
  }

  const unsubscribe = deps.changes.onChange(onChange)

  return {
    runIntentionalClear<T>(fn: () => T): T {
      intentionalClearNodes = deps.source.nodeIds()
      try {
        return fn()
      } finally {
        // The clearGraph change consumes the capture at delivery; if the
        // clear never reached the store, drop it so an unrelated later
        // clearGraph cannot borrow it.
        queueMicrotask(() => {
          intentionalClearNodes = null
        })
      }
    },
    detach: unsubscribe
  }
}
