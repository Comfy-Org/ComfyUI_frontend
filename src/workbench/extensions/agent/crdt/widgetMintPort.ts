/**
 * The widgetValueStore mint port (plan 3.3): `set_widget` is minted from the
 * store's `setValue` seam, which every human widget edit reaches (Vue node
 * widgets, the multiline textarea, the right-side parameters panel). Widget
 * identity is `graphId:nodeId:name`, so the wire op is NAME-KEYED by
 * construction - the FE-1904 requirement (the dochost sidecar projection
 * expects catalog widget names; index-keyed values throw server-side).
 *
 * A listener over an injected event feed, like the other ports: the wiring
 * site adapts the store's public `setValue` action (Pinia `$onAction`,
 * reading the old value in the before phase and the applied result in the
 * after phase). Store actions run synchronously, so provenance is the
 * session's synchronous remote-apply scope; load-driven restoration and
 * migration writes fall inside the teardown brackets.
 *
 * Top-level nodes only for now: a subgraph-interior write needs the resolved
 * node PATH (`InteriorSetWidgetOp.path`), which this block does not derive.
 * An interior write while the gate is open is surfaced observably, never
 * dropped silent.
 */
import type { GraphOperation } from './graphOperations'
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
  onSet(listener: (set: WidgetSetView) => void): () => void
}

export interface WidgetMintPortDeps {
  events: WidgetEventFeed
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

export interface WidgetMintPort {
  detach(): void
}

export function attachWidgetMintPort(deps: WidgetMintPortDeps): WidgetMintPort {
  function onSet(set: WidgetSetView): void {
    const mintable = shouldMint({
      flagEnabled: deps.isEnabled(),
      docBound: deps.isDocBound(),
      localProvenance: !deps.session.inRemoteApply(),
      teardown: deps.session.inTeardown()
    })
    if (!mintable) return

    const root = deps.rootGraphId()
    if (root === null || set.graphId !== root) {
      // The doc no longer matches the local graph; observable, never silent
      // (the surfacing-honesty principle).
      console.error(
        '[agent-crdt] subgraph-interior set_widget not minted; the bound doc diverges from the local graph',
        `${set.graphId}:${String(set.nodeId)}:${set.name}`
      )
      return
    }

    deps.enqueue([
      {
        op: 'set_widget',
        node_id: set.nodeId,
        widget: set.name,
        value: set.value,
        old: set.old
      }
    ])
  }

  const detach = deps.events.onSet(onSet)
  return { detach }
}
