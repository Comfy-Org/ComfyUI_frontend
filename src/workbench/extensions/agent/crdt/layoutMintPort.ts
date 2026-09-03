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

export const AGENT_REMOTE_ACTOR = 'agent-remote'

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

export function attachLayoutMintPort(deps: LayoutMintPortDeps): LayoutMintPort {
  let intentionalClearNodes: NodeId[] | null = null
  const reportedInteriorChanges = new Set<string>()

  function gate(change: LayoutChangeView, teardown: boolean): boolean {
    const actor = change.operation.actor
    return shouldMint({
      flagEnabled: deps.isEnabled(),
      docBound: deps.isDocBound(),
      localProvenance:
        change.operation.source !== AGENT_REMOTE_ACTOR &&
        actor !== undefined &&
        actor.startsWith(deps.localActorPrefix),
      teardown
    })
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
        const node = deps.source.serializeNode(String(operation.nodeId))
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
        return
      }
      case 'deleteNode': {
        if (!gate(change, inTeardown)) return
        if (reportUnrepresentableInteriorChange(operation, 'delete')) return
        if (operation.nodeId === undefined) return
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
