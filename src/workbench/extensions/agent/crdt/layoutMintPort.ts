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
import type { RootGraphId } from '@/types/graphScopeId'

import type { GraphOperation } from './graphOperations'
import type { SeveranceLog } from './linkMintPort'
import { shouldMint } from './mintGate'
import type { MintSession } from './mintSession'

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
  /**
   * The bound workflow's own stored root graph id, or null when no workflow
   * is bound. Read from the workflow's serialized state rather than the live
   * canvas graph, so it names the bound document's graph even while a
   * different tab is on screen or a tab switch is loading another workflow
   * into the shared canvas graph. A root-scoped change naming a different
   * graph belongs to a workflow load still in flight and must not mint into
   * this document.
   */
  boundRootGraphId(): RootGraphId | null
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

export function attachLayoutMintPort(deps: LayoutMintPortDeps): LayoutMintPort {
  let intentionalClearNodes: NodeId[] | null = null
  const reportedInteriorChanges = new Set<string>()
  const reportedUnboundGraphChanges = new Set<string>()
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
  // teardown) removal. Node ids are scoped to their root graph, so this is
  // one set per root graph, keyed by the operation's own graphId rather than
  // the (possibly null, or momentarily stale) `boundRootGraphId()` accessor:
  // a graph's bucket is then reachable only through that graph's own ops, so
  // a rebind, a still-in-flight foreign load, or a document whose id has not
  // hydrated yet can never share or evict another graph's bookkeeping.
  const mintedNodeIdsByRoot = new Map<string | null, Set<string>>()

  function mintedNodeIdsForRoot(graphId: string | null): Set<string> {
    const existing = mintedNodeIdsByRoot.get(graphId)
    if (existing) return existing
    const created = new Set<string>()
    mintedNodeIdsByRoot.set(graphId, created)
    return created
  }

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

  /**
   * The bound root graph id when `operation` names a different graph, or
   * null when it targets the bound graph (or scope cannot be judged: no
   * stored bound root graph ID, or no graphId on the operation).
   */
  function foreignBoundRootGraphId(
    operation: LayoutChangeView['operation']
  ): RootGraphId | null {
    const boundRootGraphId = deps.boundRootGraphId()
    if (boundRootGraphId === null) return null
    if (operation.graphId === undefined) return null
    if (operation.graphId === boundRootGraphId) return null
    return boundRootGraphId
  }

  function reportOpForUnboundGraph(
    operation: LayoutChangeView['operation'],
    action: 'create' | 'delete' | 'clear'
  ): boolean {
    const boundRootGraphId = foreignBoundRootGraphId(operation)
    if (boundRootGraphId === null) return false

    const reportKey = `${action}:${operation.graphId}:${boundRootGraphId}`
    if (reportedUnboundGraphChanges.has(reportKey)) return true

    reportedUnboundGraphChanges.add(reportKey)
    queueMicrotask(() => reportedUnboundGraphChanges.delete(reportKey))
    const opName = action === 'clear' ? 'clearGraph' : `${action}Node`
    reportError(
      new Error(
        `${opName} targets graph ${operation.graphId}, not the bound document's root graph ${boundRootGraphId}; refusing to mint`
      ),
      {
        errorType: 'agent_crdt_op_for_unbound_graph',
        context: {
          graphId: operation.graphId,
          boundRootGraphId,
          nodeId: operation.nodeId
        }
      }
    )
    return true
  }

  function handleCreateNode(
    change: LayoutChangeView,
    operation: LayoutChangeView['operation'],
    inTeardown: boolean
  ): void {
    if (!gate(change, inTeardown)) return
    if (reportUnrepresentableInteriorChange(operation, 'create')) return
    if (reportOpForUnboundGraph(operation, 'create')) return
    if (operation.nodeId === undefined || !operation.layout) return
    const nodeIdKey = String(operation.nodeId)
    const mintedNodeIds = mintedNodeIdsForRoot(operation.graphId ?? null)
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
  }

  function handleDeleteNode(
    change: LayoutChangeView,
    operation: LayoutChangeView['operation'],
    inTeardown: boolean
  ): void {
    // The document lost this id the moment a same-graph, root-owned
    // deleteNode change fired, regardless of whether this port also
    // gates the delete_node op for echo-suppression or teardown - the
    // two questions are independent (see the leading comment on
    // `mintedNodeIdsByRoot`). A subgraph-interior delete carries the
    // root's graphId with a different ownerGraphId, so it must not
    // forget an entry from the root's bucket for what is really a
    // different node's namespace.
    if (operation.nodeId === undefined) return
    if (operation.ownerGraphId === operation.graphId) {
      mintedNodeIdsByRoot
        .get(operation.graphId ?? null)
        ?.delete(String(operation.nodeId))
    }
    if (!gate(change, inTeardown)) return
    if (reportUnrepresentableInteriorChange(operation, 'delete')) return
    if (reportOpForUnboundGraph(operation, 'delete')) return
    deps.enqueue([
      {
        op: 'delete_node',
        node_id: operation.nodeId,
        removed_links: deps.severedLinks.take(String(operation.nodeId))
      }
    ])
  }

  function handleClearGraph(
    change: LayoutChangeView,
    operation: LayoutChangeView['operation'],
    inTeardown: boolean
  ): void {
    if (reportOpForUnboundGraph(operation, 'clear')) return
    const captured = intentionalClearNodes
    intentionalClearNodes = null
    // Only an intentional (human-confirmed) clear may forget this
    // graph's dedupe bucket: an incidental clearGraph outside that
    // bracket - a tab switch reconfiguring the shared canvas graph in
    // place - mints no doc-level clear and must leave the bucket alone
    // for nodes that are still in the doc, or a later replay re-mints
    // them (id_collision).
    if (captured !== null) {
      mintedNodeIdsByRoot.delete(operation.graphId ?? null)
    }
    if (!gate(change, inTeardown || captured === null)) return
    deps.enqueue([{ op: 'clear', removed_nodes: captured ?? [] }])
  }

  function onChange(change: LayoutChangeView): void {
    const operation = change.operation
    const inTeardown = deps.session.inTeardown()
    switch (operation.type) {
      case 'createNode':
        return handleCreateNode(change, operation, inTeardown)
      case 'deleteNode':
        return handleDeleteNode(change, operation, inTeardown)
      case 'clearGraph':
        return handleClearGraph(change, operation, inTeardown)
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
