/**
 * set_widget from the widgetValueStore setValue seam - NAME-KEYED by
 * construction (WidgetId is graphId:nodeId:name; FE-1904). Subgraph-owned
 * writes mint the interior form (path = resolved node-id chain,
 * inner_widget = the name); an unresolvable owner surfaces, never drops.
 */
import type {
  GraphMutationTarget,
  TargetedGraphOperations
} from './graphOperations'
import { shouldMint } from './mintGate'
import type { MintSession } from './mintSession'

export interface WidgetSetView {
  /** Owning (sub)graph uuid from the widget id. */
  graphId: string
  /** Node id local to the owning graph, decoded from the widget id. */
  nodeId: string | number
  /** Widget NAME, decoded from the widget id - never an index. */
  name: string
  value: unknown
  /** Value before the write (informational `old` on the wire op). */
  old: unknown
}

interface WidgetEventFeed {
  /** Fires after a `setValue` that actually applied (the action returned true). */
  onSet(
    listener: (target: GraphMutationTarget, set: WidgetSetView) => void
  ): () => void
}

export interface WidgetMintPortDeps {
  events: WidgetEventFeed
  session: MintSession
  /** Slice 00's product gate. */
  isEnabled(): boolean
  /** A semantic doc is bound for the active workflow. */
  isDocBound(): boolean
  /**
   * Subgraph-node id chain from the root to the definition owning
   * `owningGraphId`, or null when unreachable (wiring resolves it over the
   * live graph).
   */
  resolveInteriorPath(
    target: GraphMutationTarget,
    owningGraphId: string
  ): string[] | null
  /** Receives minted semantic operations (the sender's inbox). */
  enqueue(batch: TargetedGraphOperations): boolean
}

export interface WidgetMintPort {
  detach(): void
}

export function attachWidgetMintPort(deps: WidgetMintPortDeps): WidgetMintPort {
  function surfaceUnminted(reason: string, set: WidgetSetView): void {
    // The doc no longer matches the local graph; observable, never silent
    // (the surfacing-honesty principle).
    console.error(
      `[agent-crdt] set_widget ${reason}; the bound doc diverges from the local graph`,
      `${set.graphId}:${String(set.nodeId)}:${set.name}`
    )
  }

  function onSet(target: GraphMutationTarget, set: WidgetSetView): void {
    const mintable = shouldMint({
      flagEnabled: deps.isEnabled(),
      docBound: deps.isDocBound(),
      localProvenance: !deps.session.inRemoteApply(),
      teardown: deps.session.inTeardown()
    })
    if (!mintable) return

    if (set.graphId === target.rootGraphId) {
      const accepted = deps.enqueue({
        target,
        operations: [
          {
            op: 'set_widget',
            node_id: set.nodeId,
            widget: set.name,
            value: set.value,
            old: set.old
          }
        ]
      })
      if (!accepted) surfaceUnminted('rejected by the sender', set)
      return
    }

    const subgraphNodePath = deps.resolveInteriorPath(target, set.graphId)
    if (subgraphNodePath === null || subgraphNodePath.length === 0) {
      surfaceUnminted('with an unresolvable owner not minted', set)
      return
    }

    const [head, ...rest] = subgraphNodePath
    const accepted = deps.enqueue({
      target,
      operations: [
        {
          op: 'set_widget',
          node_id: set.nodeId,
          widget: set.name,
          value: set.value,
          old: set.old,
          path: [head, ...rest, String(set.nodeId)],
          inner_widget: set.name
        }
      ]
    })
    if (!accepted) surfaceUnminted('rejected by the sender', set)
  }

  const detach = deps.events.onSet(onSet)
  return { detach }
}
