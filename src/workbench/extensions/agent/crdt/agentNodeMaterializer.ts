import type { LGraph } from '@/lib/litegraph/src/LGraph'
import { materializeLinkAdapter } from '@/lib/litegraph/src/LLink'
import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import { reportError } from '@/platform/telemetry/reportError'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { GraphScope } from '@/types/graphScopeId'
import { graphScopeOf } from '@/types/graphScopeId'
import type { NodeId } from '@/types/nodeId'
import type { NodeState } from '@/types/nodeState'
import { widgetId } from '@/types/widgetId'
import type { WidgetStateInit } from '@/types/widgetState'

import { runMintPortsSuppressed } from './mintPortWiring'

export type MaterializableGraph = Pick<
  LGraph,
  | 'id'
  | 'rootGraph'
  | '_nodes'
  | '_nodes_by_id'
  | 'add'
  | 'remove'
  | 'updateExecutionOrder'
  | 'setDirtyCanvas'
  | 'list_of_graphcanvas'
  | 'onNodeRemoved'
  | 'events'
>

/**
 * Bring the live graph's node and link adapters in line with the records the
 * op layer already committed to the stores.
 *
 * Remote frames mutate the stores only. A remote add leaves a record with no
 * live node; a remote update re-registers the record under a new state object,
 * so the node that was bound to the old state no longer owns anything; a
 * remote delete leaves a node bound to nothing. A remote connect likewise
 * registers topology without constructing its live `LLink` facade. All four
 * are derived from store state here, without the op layer telling us which ids
 * changed.
 *
 * Only the scope of `graph` is reconciled. The follower passes the root graph,
 * which matches the op layer: remote operations are applied against the root
 * scope, so subgraph-owned nodes are neither adopted nor detached here.
 *
 * @returns ids that received a new live node.
 */
export function reconcileAgentAdapters(graph: MaterializableGraph): NodeId[] {
  return runMintPortsSuppressed(() => reconcile(graph))
}

function reconcile(graph: MaterializableGraph): NodeId[] {
  const scope = graphScopeOf(graph)
  // Remote connect registers canonical topology without importing LiteGraph.
  // Install its facade before node.configure() can query links; otherwise the
  // occupied input is real in the store but graph lookup and painting miss it.
  for (const topology of useLinkStore().graphTopologies(scope)) {
    materializeLinkAdapter(graph, topology)
  }

  const nodeStore = useNodeDataStore()
  const records = nodeStore.getGraphNodesFor(
    scope.rootGraphId,
    scope.owningGraphId
  )
  const orphans = graph._nodes.filter(
    (node) => !nodeStore.ownsNode(scope, node._state)
  )
  const orphansById = new Map(orphans.map((node) => [node.id, node]))

  const materialized: NodeId[] = []
  for (const state of records) {
    const live = graph._nodes_by_id[state.id]
    if (live && nodeStore.ownsNode(scope, live._state)) continue
    const serialised = state.lastSerialization
    if (!serialised) continue
    if (
      materialize(graph, scope, state, serialised, orphansById.get(state.id))
    ) {
      materialized.push(state.id)
    }
  }

  const recordIds = new Set(records.map((state) => state.id))
  const detached = orphans.filter(
    (orphan) =>
      graph._nodes_by_id[orphan.id] !== orphan || !recordIds.has(orphan.id)
  )
  for (const orphan of detached) detachOrphan(graph, orphan)
  if (detached.length > 0) {
    graph.updateExecutionOrder()
    graph.setDirtyCanvas(true, true)
  }
  return materialized
}

function materialize(
  graph: MaterializableGraph,
  scope: GraphScope,
  state: NodeState,
  serialised: ISerialisedNode,
  orphan: LGraphNode | undefined
): boolean {
  const nodeStore = useNodeDataStore()
  const widgetStore = useWidgetValueStore()
  const node =
    LiteGraph.createNode(state.type, state.title) ?? missingNode(state)
  node.id = state.id

  const widgets = widgetStore.getNodeWidgets(scope.rootGraphId, state.id).map(
    (widget): WidgetStateInit => ({
      disabled: widget.disabled,
      label: widget.label,
      name: widget.name,
      options: widget.options,
      serialize: widget.serialize,
      type: widget.type,
      value: widget.value,
      y: widget.y
    })
  )
  const restore = () => {
    nodeStore.registerNode(scope, state)
    for (const widget of widgets) {
      widgetStore.registerWidget(
        widgetId(scope.rootGraphId, state.id, widget.name ?? ''),
        widget
      )
    }
    if (orphan) graph._nodes_by_id[orphan.id] = orphan
  }

  const rollback = (cause: unknown) => {
    // `add()` may throw after attaching (from `onAdded`); only then is there
    // a live node to take back out.
    //
    // Taking it out is best-effort and `restore()` is not: `LGraph.remove()`
    // runs `onRemoved()` uncaught, so an extension that throws on both halves
    // of the lifecycle would otherwise escape here and strand the records this
    // function deleted -- the store record gone and a partial adapter live,
    // which is worse than either failure alone. Put the authoritative state
    // back first and report the cleanup failure separately.
    let cleanupCause: unknown
    let cleanupFailed = false
    try {
      if (graph._nodes_by_id[node.id] === node) graph.remove(node)
    } catch (error) {
      cleanupCause = error
      cleanupFailed = true
    }
    restore()
    reportError(cause, {
      errorType: 'agent_node_materialize_add_failed',
      context: { graphId: graph.id, nodeId: String(state.id) }
    })
    if (cleanupFailed) {
      reportError(cleanupCause, {
        errorType: 'agent_node_materialize_rollback_failed',
        context: { graphId: graph.id, nodeId: String(state.id) }
      })
    }
    return false
  }

  // `add()` only adopts the record's id into an empty slot; with the record
  // still registered its collision loop would mint a fresh id instead.
  //
  // `add()` also adopts the record's layout entry rather than creating one:
  // the op layer created it with remote provenance, and the layout store
  // delivers changes on a microtask, after the mint-suppression bracket has
  // ended. Provenance on the operation, not the bracket, is what keeps the
  // layout port quiet here.
  nodeStore.deleteNode(scope, state)
  let added: LGraphNode | null | undefined
  try {
    added = graph.add(node)
  } catch (cause) {
    return rollback(cause)
  }
  if (!added) return rollback('LGraph.add returned no node')

  try {
    node.configure(withNamedWidgetValues(serialised))
  } catch (cause) {
    // The node is attached and consistent with the stores; removing it here
    // would also drop the layout entry it adopted. Keep it and report.
    reportError(cause, {
      errorType: 'agent_node_materialize_configure_failed',
      context: { graphId: graph.id, nodeId: String(state.id) }
    })
  }
  return true
}

/**
 * Drop a node the stores no longer know about from the live graph without
 * going through `LGraph.remove()`: that path unregisters store state, releases
 * widget records and emits a layout delete, all of which now belong to the
 * record (and replacement node) that took over the id.
 */
function detachOrphan(graph: MaterializableGraph, orphan: LGraphNode): void {
  try {
    orphan.onRemoved?.()
  } catch (cause) {
    console.error(cause)
  }
  const index = graph._nodes.indexOf(orphan)
  if (index !== -1) graph._nodes.splice(index, 1)
  if (graph._nodes_by_id[orphan.id] === orphan) {
    delete graph._nodes_by_id[orphan.id]
  }
  for (const canvas of graph.list_of_graphcanvas ?? []) {
    delete canvas.selected_nodes[orphan.id]
    canvas.deselect(orphan)
  }
  orphan.graph = null
  orphan._graphScope = undefined
  graph.onNodeRemoved?.(orphan)
  graph.events.dispatch('node:removed', { node: orphan })
}

/** Same placeholder `LGraph.configure()` builds for an unregistered type. */
function missingNode(state: NodeState): LGraphNode {
  const node = new LGraphNode(
    state.title || state.type || 'Missing Node',
    state.type
  )
  node.has_errors = true
  return node
}

/**
 * Op-layer serialisations carry widget values keyed by name; `configure()`
 * only reads name-keyed values from `widgets_values_named`.
 */
function withNamedWidgetValues(serialised: ISerialisedNode): ISerialisedNode {
  const values = serialised.widgets_values
  if (
    values === undefined ||
    Array.isArray(values) ||
    serialised.widgets_values_named !== undefined
  ) {
    return serialised
  }
  return { ...serialised, widgets_values_named: values }
}
