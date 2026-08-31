/**
 * Layout-store mint port over the injected change feed (both applyOperation
 * entries funnel through it). Provenance rides each operation's source and
 * actor, so deferred delivery still carries it; remote applies never re-mint
 * (KA-6). Teardown clears are inert
 * outside runIntentionalClear, whose capture is the authoritative pre-clear
 * node set; delete_node consumes the link port's severance capture.
 */
import type { NodeId, WorkflowNode } from '@comfyorg/comfy-multi-player'

import type {
  GraphMutationTarget,
  TargetedGraphOperations
} from './graphOperations'
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
    graphId: string
    actor?: string
    source?: string
    nodeId?: NodeId
    layout?: { position: { x: number; y: number } }
  }
}

interface LayoutChangeFeed {
  onChange(
    listener: (target: GraphMutationTarget, change: LayoutChangeView) => void
  ): () => void
}

/** The workflow-JSON node snapshot an `add_node` carries, read at mint time. */
interface MintSnapshotSource {
  /** Serialized workflow-JSON node for `id`, or null when unavailable. */
  serializeNode(target: GraphMutationTarget, id: string): WorkflowNode | null
  /** Every node id currently on the graph (clear's authoritative target set). */
  nodeIds(target: GraphMutationTarget): NodeId[]
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
  /** Stable identity of the document currently shown by the graph surface. */
  target(): GraphMutationTarget | null
  source: MintSnapshotSource
  /** Receives minted semantic operations (the sender's inbox). */
  enqueue(batch: TargetedGraphOperations): void
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

interface IntentionalClear {
  target: GraphMutationTarget
  nodeIds: NodeId[]
}

function sameTarget(
  left: GraphMutationTarget,
  right: GraphMutationTarget
): boolean {
  return (
    left.workflowId === right.workflowId &&
    left.rootGraphId === right.rootGraphId
  )
}

export function attachLayoutMintPort(deps: LayoutMintPortDeps): LayoutMintPort {
  let intentionalClear: IntentionalClear | null = null

  function gate(
    target: GraphMutationTarget,
    change: LayoutChangeView,
    teardown: boolean
  ): boolean {
    const actor = change.operation.actor
    return shouldMint({
      flagEnabled: deps.isEnabled(),
      docBound: deps.isDocBound(),
      localProvenance:
        change.operation.graphId === target.rootGraphId &&
        change.operation.source !== AGENT_REMOTE_ACTOR &&
        actor !== undefined &&
        actor.startsWith(deps.localActorPrefix),
      teardown
    })
  }

  function onChange(
    target: GraphMutationTarget,
    change: LayoutChangeView
  ): void {
    const operation = change.operation
    const inTeardown = deps.session.inTeardown()
    switch (operation.type) {
      case 'createNode': {
        if (!gate(target, change, inTeardown)) return
        if (operation.nodeId === undefined || !operation.layout) return
        const node = deps.source.serializeNode(target, String(operation.nodeId))
        if (!node) {
          // A dropped human mint is a local-graph-vs-doc divergence; it must
          // be observable, never silent (the surfacing-honesty principle).
          console.error(
            '[agent-crdt] add_node mint dropped: no snapshot for node',
            operation.nodeId
          )
          return
        }
        deps.enqueue({
          target,
          operations: [
            {
              op: 'add_node',
              node_id: operation.nodeId,
              class_type: String(node.type),
              pos: [operation.layout.position.x, operation.layout.position.y],
              node
            }
          ]
        })
        return
      }
      case 'deleteNode': {
        if (!gate(target, change, inTeardown)) return
        if (operation.nodeId === undefined) return
        deps.enqueue({
          target,
          operations: [
            {
              op: 'delete_node',
              node_id: operation.nodeId,
              removed_links: deps.severedLinks.take(
                target,
                String(operation.nodeId)
              )
            }
          ]
        })
        return
      }
      case 'clearGraph': {
        const captured = intentionalClear
        intentionalClear = null
        if (captured === null || !sameTarget(captured.target, target)) return
        if (!gate(target, change, inTeardown)) return
        deps.enqueue({
          target,
          operations: [{ op: 'clear', removed_nodes: captured.nodeIds }]
        })
        return
      }
      default:
        return
    }
  }

  const unsubscribe = deps.changes.onChange(onChange)

  return {
    runIntentionalClear<T>(fn: () => T): T {
      const target = deps.target()
      intentionalClear = target
        ? { target, nodeIds: deps.source.nodeIds(target) }
        : null
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
