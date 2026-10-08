/**
 * set_widget from the widgetValueStore setValue seam - NAME-KEYED by
 * construction (WidgetId is graphId:nodeId:name; FE-1904). Subgraph-owned
 * writes mint the interior form (path = resolved node-id chain,
 * inner_widget = the name); an unresolvable owner surfaces, never drops.
 */
import type { PromotedHostWrite } from '@comfyorg/comfy-multi-player'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { isWidgetValue } from '@/lib/litegraph/src/types/widgets'
import { reportError } from '@/platform/telemetry/reportError'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { NodeId } from '@/types/nodeId'

import type { DocPromotedWidgets } from './agentSubgraphDefinitions'
import type { GraphOperation } from './graphOperations'
import { shouldMint } from './mintGate'
import type { MintSession } from './mintSession'

export interface WidgetSetView {
  /** Owning (sub)graph uuid from the widget id. */
  graphId: string
  /** Node id local to the owning graph, decoded from the widget id. */
  nodeId: NodeId
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
  /** The root graph's live node with this id, or null when absent. */
  rootNode(nodeId: NodeId): LGraphNode | null
  /** The bound document's promoted-widget layout for this root node. */
  docPromotedWidgets(nodeId: NodeId): DocPromotedWidgets | null
  /**
   * Subgraph-node id chain from the root to the definition owning
   * `owningGraphId`, or null when unreachable (wiring resolves it over the
   * live graph).
   */
  resolveInteriorPath(owningGraphId: string): string[] | null
  /** Receives minted semantic operations (the sender's inbox). */
  enqueue(operations: GraphOperation[]): void
}

export interface WidgetMintPort {
  detach(): void
}

function documentAcceptsLiveIndex(
  doc: DocPromotedWidgets | null,
  liveNames: readonly string[]
): boolean {
  if (doc === null) return true
  const namesMatch =
    doc.promotedNames != null &&
    doc.promotedNames.length === liveNames.length &&
    doc.promotedNames.every((name, index) => name === liveNames[index])
  if (doc.valueCount === 0) return doc.promotedNames === undefined || namesMatch
  return doc.valueCount === liveNames.length && namesMatch
}

function promotedHostWrite(
  node: LGraphNode | null,
  set: WidgetSetView,
  doc: DocPromotedWidgets | null,
  onOrderDrift: (names: readonly string[], doc: DocPromotedWidgets) => void
): PromotedHostWrite | null {
  if (!node?.isSubgraphNode()) return null
  const hostInputs = node.inputs.flatMap((input) =>
    input.widgetId ? [{ name: input.name, widgetId: input.widgetId }] : []
  )
  const valueIndex = hostInputs.findIndex((input) => input.name === set.name)
  if (valueIndex === -1) return null
  const liveNames = hostInputs.map((input) => input.name)
  if (!documentAcceptsLiveIndex(doc, liveNames)) {
    if (doc) onOrderDrift(liveNames, doc)
    return null
  }
  const widgetValueStore = useWidgetValueStore()
  return {
    value_index: valueIndex,
    instance_path: [String(set.nodeId)],
    host_widgets_values: hostInputs.map((input, index) => {
      if (index === valueIndex) return set.value
      const value = widgetValueStore.getWidget(input.widgetId)?.value
      return isWidgetValue(value) ? value : undefined
    })
  }
}

export function attachWidgetMintPort(deps: WidgetMintPortDeps): WidgetMintPort {
  const reportedDrift = new Set<string>()

  function reportDrift(
    rootGraphId: string,
    set: WidgetSetView,
    liveNames: readonly string[],
    doc: DocPromotedWidgets
  ): void {
    const key = `${rootGraphId}:${String(set.nodeId)}`
    if (reportedDrift.has(key)) return
    reportedDrift.add(key)
    reportError(
      new Error(
        `Subgraph host ${String(set.nodeId)} promotes [${liveNames.join(', ')}], which the document's ${doc.valueCount} stored values and declared inputs [${doc.declaredNames.join(', ')}] do not place; refusing to mint a promoted write`
      ),
      {
        errorType: 'agent_crdt_promoted_widget_order_drift',
        context: {
          nodeId: set.nodeId,
          liveNames,
          docValueCount: doc.valueCount,
          docDeclaredNames: doc.declaredNames,
          docPromotedNames: doc.promotedNames
        }
      }
    )
  }

  function onSet(set: WidgetSetView): void {
    const mintable = shouldMint({
      flagEnabled: deps.isEnabled(),
      docBound: deps.isDocBound(),
      teardown: deps.session.inTeardown()
    })
    if (!mintable) return

    const root = deps.rootGraphId()
    if (root !== null && set.graphId === root) {
      const node = deps.rootNode(set.nodeId)
      if (node?.isSubgraphNode()) {
        const doc = deps.docPromotedWidgets(set.nodeId)
        const promoted = promotedHostWrite(
          node,
          set,
          doc,
          (liveNames, layout) => reportDrift(root, set, liveNames, layout)
        )
        if (!promoted) return
        deps.enqueue([
          {
            op: 'set_widget',
            node_id: set.nodeId,
            widget: set.name,
            value: set.value,
            old: set.old,
            promoted
          }
        ])
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
      return
    }

    const subgraphNodePath =
      root === null ? null : deps.resolveInteriorPath(set.graphId)
    if (subgraphNodePath === null || subgraphNodePath.length === 0) {
      // The doc no longer matches the local graph; observable, never silent
      // (the surfacing-honesty principle).
      console.error(
        '[agent-crdt] set_widget with an unresolvable owner not minted; the bound doc diverges from the local graph',
        `${set.graphId}:${String(set.nodeId)}:${set.name}`
      )
      return
    }

    const [head, ...rest] = subgraphNodePath
    deps.enqueue([
      {
        op: 'set_widget',
        node_id: set.nodeId,
        widget: set.name,
        value: set.value,
        old: set.old,
        path: [head, ...rest, String(set.nodeId)],
        inner_widget: set.name
      }
    ])
  }

  const detach = deps.events.onSet(onSet)
  return { detach }
}
