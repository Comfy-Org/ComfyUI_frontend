/**
 * The layoutStore mint port (plan 3.3): observes the layout store's change
 * seam - the shared inner path both `applyOperation` entries funnel through -
 * and mints semantic {@link GraphOperation}s for human edits. A listener over
 * an injected change feed, not a store method: behavior stays in a system
 * (ADR 0003/0008), workbench stays free of renderer imports (the same
 * constraint that shapes `LitegraphMutator`), and BOTH transaction entries
 * are covered because both finalize through the same change queue.
 *
 * Provenance rides `operation.actor` (stamped synchronously at apply time,
 * so the store's deferred change delivery still carries it): local human
 * edits carry the session's local-actor prefix; a remote applier runs inside
 * the store's actor scope as {@link AGENT_REMOTE_ACTOR} so its echoes are
 * distinguishable and never re-minted (KA-6's sender half).
 *
 * Teardown is first-class: workflow load/switch/close drives `LGraph.clear()`
 * through the store with no call-carried provenance, so `clearGraph` changes
 * are INERT unless inside an explicit {@link LayoutMintPort.runIntentionalClear}
 * window, and the load path holds the shared session's teardown brackets
 * around every graph load. The intentional-clear window also captures clear's
 * payload: `removed_nodes` is the AUTHORITATIVE mint-time node set, read
 * BEFORE the clear runs (post-clear the graph is already empty).
 *
 * delete_node's `removed_links` payload is severed before change delivery,
 * so it comes from the link port's severance log: litegraph severs a node's
 * links synchronously (each recorded by the link port) before the store's
 * deleteNode change delivers on its microtask, and this port consumes the
 * capture at mint time.
 */
import type { NodeId, WorkflowNode } from '@comfyorg/comfy-multi-player'

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
    actor?: string
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

  function gate(change: LayoutChangeView, teardown: boolean): boolean {
    const actor = change.operation.actor
    return shouldMint({
      flagEnabled: deps.isEnabled(),
      docBound: deps.isDocBound(),
      localProvenance:
        actor !== undefined && actor.startsWith(deps.localActorPrefix),
      teardown
    })
  }

  function onChange(change: LayoutChangeView): void {
    const operation = change.operation
    const inTeardown = deps.session.inTeardown()
    switch (operation.type) {
      case 'createNode': {
        if (!gate(change, inTeardown)) return
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
            class_type: String(node.type),
            pos: [operation.layout.position.x, operation.layout.position.y],
            node
          }
        ])
        return
      }
      case 'deleteNode': {
        if (!gate(change, inTeardown)) return
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
