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

/**
 * The structural slice of the layout store's LayoutChange this port reads.
 * Structural on purpose: the real feed passes the store's own change objects
 * through without this module importing renderer types.
 */
export interface LayoutChangeView {
  operation: {
    type: string
    /**
     * Root graph the change belongs to. Required, mirroring the store's own
     * `LayoutOperation`: a change that names no graph cannot be attributed to
     * a document, and the targeting rule below has no fail-open case to fall
     * into.
     */
    graphId: string
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
  /**
   * Root graph id of the document the activation coordinator currently has
   * activated, or null while no document holds the canvas. Sourced from the
   * activation host, never re-derived from the live canvas graph: the shared
   * `LGraph` is reconfigured in place on a tab switch, so its own id already
   * names the incoming tab while a previous tab's queued changes are still
   * draining.
   */
  activeRootGraphId(): RootGraphId | null
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
 * Collapses a burst of identical drops into one signal: a tab switch emits a
 * change per node, and each would otherwise report separately.
 */
function createOncePerTickReporter(): (
  key: string,
  report: () => void
) => void {
  const reported = new Set<string>()
  return (key, report) => {
    if (reported.has(key)) return
    reported.add(key)
    queueMicrotask(() => reported.delete(key))
    report()
  }
}

/** An in-flight {@link LayoutMintPort.runIntentionalClear} window. */
interface IntentionalClear {
  /** The authoritative pre-clear node set. */
  readonly nodeIds: NodeId[]
  /**
   * The activated root graph id when the window opened. `LGraph.clear()`
   * remints the root id under the same document, so the clearGraph change
   * that arrives names this id, not the one activation now publishes.
   */
  readonly rootGraphId: RootGraphId | null
}

export function attachLayoutMintPort(deps: LayoutMintPortDeps): LayoutMintPort {
  let intentionalClear: IntentionalClear | null = null
  const reportInteriorChangeOnce = createOncePerTickReporter()
  const reportInactiveChangeOnce = createOncePerTickReporter()
  // Ids this port has itself minted an add_node for, and that the local
  // document has not since lost, one bucket per root graph keyed by the
  // operation's own graphId. A redo/replay re-delivers the same createNode
  // shape a genuine new node would for an id this port already relayed
  // (litegraph's own undo/redo stack, or a create op replaying across two
  // tabs bound to the same root graph); without this, the port would mint a
  // second add_node for a node the doc already has. isForActivatedDocument
  // already guarantees `operation.graphId` names the activated document by
  // the time a create/delete reaches its bucket lookup, so - unlike a bare
  // accessor read - the key is never the ambiguous "activation unresolved"
  // case main's version had to special-case.
  const mintedNodeIdsByRoot = new Map<string, Set<string>>()

  function mintedNodeIdsForRoot(graphId: string): Set<string> {
    const existing = mintedNodeIdsByRoot.get(graphId)
    if (existing) return existing
    const created = new Set<string>()
    mintedNodeIdsByRoot.set(graphId, created)
    return created
  }

  /** Local human provenance: neither a remote apply nor another actor. */
  function isLocalHumanChange(change: LayoutChangeView): boolean {
    return (
      change.operation.source !== 'agent-remote' &&
      change.operation.actor?.startsWith(deps.localActorPrefix) === true
    )
  }

  function gate(change: LayoutChangeView, teardown: boolean): boolean {
    return (
      isLocalHumanChange(change) &&
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

    reportInteriorChangeOnce(
      `${action}:${operation.graphId}:${operation.ownerGraphId}`,
      () =>
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
    )
    return true
  }

  /**
   * A root-scoped change belongs to the activated document only when it names
   * that document's own root graph. Anything else is a change for a graph the
   * canvas is no longer showing — the tab-switch race — and must never reach
   * the wire.
   *
   * Fails closed while nothing is activated, because that window IS the
   * handoff: the load path retracts the outgoing binding before the shared
   * graph is reconfigured, so a change draining in between has no document
   * to belong to.
   *
   * `expected` is the id the change must name. It is the activated document's
   * root graph id, except inside an intentional-clear window, where the clear
   * itself remints that id and the pre-clear capture holds the honest one.
   */
  function isForActivatedDocument(
    operation: LayoutChangeView['operation'],
    action: 'create' | 'delete' | 'clear',
    expected: RootGraphId | null = deps.activeRootGraphId()
  ): boolean {
    if (operation.graphId === expected) return true

    reportInactiveChangeOnce(`${action}:${operation.graphId}:${expected}`, () =>
      reportError(
        new Error(
          `Root-scoped ${action} names a graph the activated document does not own; dropping instead of minting into the wrong document`
        ),
        {
          errorType: 'agent_crdt_op_for_inactive_document',
          context: {
            graphId: operation.graphId,
            activeRootGraphId: expected,
            nodeId: operation.nodeId
          }
        }
      )
    )
    return false
  }

  function onChange(change: LayoutChangeView): void {
    const operation = change.operation
    const inTeardown = deps.session.inTeardown()
    switch (operation.type) {
      case 'createNode': {
        if (!gate(change, inTeardown)) return
        if (!isForActivatedDocument(operation, 'create')) return
        if (reportUnrepresentableInteriorChange(operation, 'create')) return
        if (operation.nodeId === undefined || !operation.layout) return
        const nodeIdKey = String(operation.nodeId)
        const mintedNodeIds = mintedNodeIdsForRoot(operation.graphId)
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
            node
          }
        ])
        mintedNodeIds.add(nodeIdKey)
        return
      }
      case 'deleteNode': {
        // The document lost this id the moment a same-graph, root-owned
        // deleteNode change fired, regardless of whether this port also
        // gates the delete_node op for echo-suppression, targeting, or
        // teardown - those are independent questions. A subgraph-interior
        // delete carries the root's graphId with a different ownerGraphId,
        // so it must not forget an entry from the root's bucket for what is
        // really a different node's namespace.
        if (operation.nodeId === undefined) return
        if (operation.ownerGraphId === operation.graphId) {
          mintedNodeIdsByRoot
            .get(operation.graphId)
            ?.delete(String(operation.nodeId))
        }
        if (!gate(change, inTeardown)) return
        if (!isForActivatedDocument(operation, 'delete')) return
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
        if (!isLocalHumanChange(change)) return
        // clearGraph is root-scoped by construction (layoutStore.clearGraph
        // takes a root graph id), so its own graphId classifies it. Targeting
        // is decided BEFORE the capture is consumed: a foreign clear that
        // borrowed the capture would leave the genuine one that follows
        // looking like teardown, and a human clear would mint nothing.
        const pending = intentionalClear
        const expected = pending
          ? pending.rootGraphId
          : deps.activeRootGraphId()
        if (!isForActivatedDocument(operation, 'clear', expected)) return
        intentionalClear = null
        const captured = pending?.nodeIds ?? null
        // Only an intentional (human-confirmed) clear may forget this
        // graph's dedupe bucket: an incidental clearGraph outside that
        // bracket - a tab switch reconfiguring the shared canvas graph in
        // place - mints no doc-level clear and must leave the bucket alone
        // for nodes still in the doc, or a later replay re-mints them.
        if (captured !== null) mintedNodeIdsByRoot.delete(operation.graphId)
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
      intentionalClear = {
        nodeIds: deps.source.nodeIds(),
        rootGraphId: deps.activeRootGraphId()
      }
      try {
        return fn()
      } finally {
        // The clearGraph change consumes the capture at delivery; if the
        // clear never reached the store, drop it so an unrelated later
        // clearGraph cannot borrow it.
        queueMicrotask(() => {
          intentionalClear = null
        })
      }
    },
    detach: unsubscribe
  }
}
