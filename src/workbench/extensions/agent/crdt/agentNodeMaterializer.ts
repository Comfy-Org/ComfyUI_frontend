import { reconcileAutogrowInputs } from '@/core/graph/widgets/dynamicWidgets'
import type {
  AdoptCanonicalNodeStage,
  LGraph
} from '@/lib/litegraph/src/LGraph'
import { materializeLinkAdapter } from '@/lib/litegraph/src/LLink'
import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { topologicalSortSubgraphs } from '@/lib/litegraph/src/subgraph/subgraphDeduplication'
import type {
  ExportedSubgraph,
  ISerialisedNode
} from '@/lib/litegraph/src/types/serialisation'
import { reportError } from '@/platform/telemetry/reportError'
import { isUuidShapedSubgraphId } from '@/schemas/subgraphIdSchema'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { GraphScope } from '@/types/graphScopeId'
import { graphScopeOf } from '@/types/graphScopeId'
import type { NodeId } from '@/types/nodeId'
import type { NodeState } from '@/types/nodeState'
import type { WidgetValue } from '@/types/simplifiedWidget'
import { widgetId } from '@/types/widgetId'

import { allSubgraphDefinitions } from './agentSubgraphDefinitions'
import { runMintPortsSuppressed } from './mintPortWiring'

export type MaterializableGraph = Pick<
  LGraph,
  | 'id'
  | 'rootGraph'
  | 'nodes'
  | '_nodes'
  | '_nodes_by_id'
  | 'adoptCanonicalNode'
  | 'remove'
  | 'setDirtyCanvas'
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
 * @param subgraphDefinitions explicitly created definitions present in the
 * document. Root nodes typed by a definition id can only materialize once the
 * definition is registered on the root graph.
 * @returns ids that received a new live node.
 */
export function reconcileAgentAdapters(
  graph: MaterializableGraph,
  subgraphDefinitions: ExportedSubgraph[] = []
): NodeId[] {
  return runMintPortsSuppressed(() => {
    const pending = registerSubgraphDefinitions(graph, subgraphDefinitions)
    return reconcile(graph, pending)
  })
}

/**
 * Definition ids already reported as failing to register, per root graph, so
 * a definition that keeps failing across reconcile frames is reported once.
 */
const reportedDefinitionFailures = new WeakMap<LGraph, Set<string>>()

/**
 * Register explicitly created subgraph definitions the root graph does not
 * know yet.
 *
 * This is the same entry point the human load path uses
 * (`useSubgraphService().loadSubgraphs` → `rootGraph.createSubgraph(s)`), so
 * each definition dispatches `subgraph-created` and the app handler registers
 * the definition id as a `SubgraphNode` type before any root node of that type
 * is materialized. Without it `LiteGraph.createNode(definitionId)` returns
 * null and the instance degrades to an error placeholder.
 *
 * Definitions are registered one at a time, leaves before the definitions
 * that nest them, so a definition that throws while configuring is rolled off
 * the root graph (and retried on the next frame) without taking a healthy
 * sibling down with it. Definitions already present on the root graph are left
 * untouched: edits address interior nodes through normal node operations, not
 * by replacing an existing definition.
 *
 * @returns ids of definitions from the document that are still not registered
 * on the root graph.
 */
function registerSubgraphDefinitions(
  graph: MaterializableGraph,
  definitions: ExportedSubgraph[]
): Set<string> {
  const rootGraph = graph.rootGraph
  // Filter after flattening: a live nested definition must not be recreated
  // just because its outer is missing, and a missing nested definition must
  // still register when its outer is already live.
  const missing = allSubgraphDefinitions(definitions)
    .map((definition) => ({ ...definition, definitions: undefined }))
    .filter((definition) => !rootGraph.subgraphs.has(definition.id))
  const pending = new Set(missing.map((definition) => definition.id))
  if (missing.length === 0) return pending

  const reported =
    reportedDefinitionFailures.get(rootGraph) ??
    reportedDefinitionFailures.set(rootGraph, new Set()).get(rootGraph)!

  for (const definition of topologicalSortSubgraphs(missing)) {
    const failure = tryCreateSubgraph(rootGraph, definition)
    if (failure === undefined) {
      pending.delete(definition.id)
      reported.delete(definition.id)
      continue
    }
    if (reported.has(definition.id)) continue
    reported.add(definition.id)
    reportError(failure, {
      errorType: 'agent_subgraph_definitions_failed',
      context: { graphId: graph.id, definitionId: definition.id }
    })
  }
  return pending
}

/**
 * Register one definition on the root graph.
 *
 * @returns the failure when the definition could not be registered, after
 * rolling any half-built entry back off the root graph so the next frame can
 * retry it; `undefined` on success.
 */
function tryCreateSubgraph(
  rootGraph: LGraph,
  definition: ExportedSubgraph
): unknown {
  // createSubgraphs remints a non-UUID id, which would leave every node typed
  // by the document's id pointing at a definition that never registers. The
  // op layer only mints UUIDs; treat anything else as a broken document
  // rather than silently diverging from it.
  if (!isUuidShapedSubgraphId(definition.id)) {
    return new Error(
      `Agent subgraph definition id is not a UUID: ${definition.id}`
    )
  }
  try {
    withNamedValuesRestore(() => rootGraph.createSubgraph(definition))
    return undefined
  } catch (cause) {
    // createSubgraph registers the definition before configuring it. Tear the
    // half-built entry down through the same path node removal uses: a bare
    // map delete would leave its graph metadata behind, and the Subgraph
    // constructor remints the id on the next attempt when it finds that
    // metadata, so the retry would never land under the document's id.
    const halfBuilt = rootGraph.subgraphs.get(definition.id)
    if (halfBuilt) {
      try {
        rootGraph.releaseSubgraphs([halfBuilt])
      } catch (rollbackCause) {
        return new AggregateError(
          [cause, rollbackCause],
          `Agent subgraph definition ${definition.id} failed to register and roll back`
        )
      }
    }
    return cause
  }
}

/**
 * Run `fn` with `LGraphNode.configure()` honouring `widgets_values_named`.
 *
 * The op layer stores interior widget values by name and the follower has no
 * widget catalog to project them positionally the way the package's
 * `project()` does. Named restore is otherwise gated behind the experimental
 * `Comfy.Workflow.NamedValuesRestore` setting; enabling it only while the
 * agent's definitions configure lets values land inside `configure()`, before
 * `onConfigure`, exactly as they do for a human-loaded workflow.
 */
function withNamedValuesRestore<T>(fn: () => T): T {
  const previous = LiteGraph.namedValuesRestore
  LiteGraph.namedValuesRestore = true
  try {
    return fn()
  } finally {
    LiteGraph.namedValuesRestore = previous
  }
}

/**
 * @param pendingDefinitions definition ids the document seeds but the root
 * graph could not register. Nodes typed by one stay unmaterialized rather
 * than degrading to a placeholder: a `subgraph-created` handler may already
 * have bound the type to the rolled-back `Subgraph`, and the record is picked
 * up as soon as the definition registers.
 */
function reconcile(
  graph: MaterializableGraph,
  pendingDefinitions: Set<string>
): NodeId[] {
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
    if (materializeRecord(graph, scope, state, orphansById, pendingDefinitions))
      materialized.push(state.id)
  }

  const recordIds = new Set(records.map((state) => state.id))
  const detached = orphans.filter(
    (orphan) =>
      orphan.graph === graph &&
      (graph._nodes_by_id[orphan.id] !== orphan || !recordIds.has(orphan.id))
  )
  for (const orphan of detached) {
    graph.remove(orphan, { preserveCanonicalState: true })
  }
  return materialized
}

/**
 * Selects the adapter work for one record: nothing for a live owner, a swap
 * for a placeholder whose type registered since it was built, a fresh adapter
 * otherwise. Ownership is never rewritten here; `materialize` performs the
 * replacement as one transaction.
 */
function materializeRecord(
  graph: MaterializableGraph,
  scope: GraphScope,
  state: NodeState,
  orphansById: Map<NodeId, LGraphNode>,
  pendingDefinitions: Set<string>
): boolean {
  const nodeStore = useNodeDataStore()
  const live = graph._nodes_by_id[state.id]
  const owned = !!live && nodeStore.ownsNode(scope, live._state)
  if (owned && !isRebindablePlaceholder(live, state)) {
    reconcileAutogrowInputs(live)
    return false
  }
  const serialised = state.lastSerialization
  if (!serialised || pendingDefinitions.has(state.type)) return false
  const orphan = owned ? live : orphansById.get(state.id)
  return materialize(graph, scope, state, serialised, orphan)
}

/** `LGraph.configure()` builds a bare `LGraphNode` for a type it cannot find. */
function isRebindablePlaceholder(node: LGraphNode, state: NodeState): boolean {
  return (
    node.constructor === LGraphNode &&
    Object.hasOwn(LiteGraph.registered_node_types, state.type)
  )
}

/**
 * Hands the record to a freshly built adapter through the graph's own
 * adoption transaction. The graph owns every ownership step (detaching the
 * orphan, binding the record, attaching, rolling back); this layer only
 * builds the successor and fills it from the record once it is attached.
 *
 * The record's layout entry is adopted rather than recreated: the op layer
 * created it with remote provenance, and the layout store delivers changes on
 * a microtask, after the mint-suppression bracket has ended. Provenance on the
 * operation, not the bracket, is what keeps the layout port quiet here.
 */
function materialize(
  graph: MaterializableGraph,
  scope: GraphScope,
  state: NodeState,
  serialised: ISerialisedNode,
  orphan: LGraphNode | undefined
): boolean {
  const node = createAdapterNode(graph, state)
  if (!node) return false
  const snapshot = snapshotStoreWidgets(scope, state, orphan)

  const result = graph.adoptCanonicalNode(state, node, {
    incumbent: orphan,
    configure: (successor) => {
      withNamedValuesRestore(() =>
        successor.configure(withNamedWidgetValues(serialised, successor))
      )
      applyStoredValues(successor, snapshot.storedValues)
      dropPlaceholderMirrors(
        scope,
        state,
        successor,
        snapshot.placeholderWidgetNames
      )
    }
  })
  if (result.status === 'replaced') return true

  const context = { graphId: graph.id, nodeId: String(state.id) }
  // The graph only disposes a successor it began attaching. When it refused
  // up front, the node we built is still ours and nothing else holds it.
  if (result.status === 'reentrant' || result.stage === 'precondition') {
    try {
      node.onRemoved?.()
    } catch (failure) {
      reportError(failure, {
        errorType: 'agent_node_materialize_rollback_failed',
        context
      })
    }
  }
  if (result.status === 'reentrant') {
    reportError(
      'reconcileAgentAdapters re-entered from a node lifecycle hook',
      {
        errorType: 'agent_node_materialize_reentrant',
        context
      }
    )
    return false
  }
  reportError(result.cause, {
    errorType: ADOPTION_FAILURE_ERROR_TYPE[result.stage],
    context
  })
  for (const failure of result.rollbackFailures) {
    reportError(failure, {
      errorType: 'agent_node_materialize_rollback_failed',
      context
    })
  }
  return false
}

const ADOPTION_FAILURE_ERROR_TYPE: Record<AdoptCanonicalNodeStage, string> = {
  precondition: 'agent_node_materialize_add_failed',
  detach: 'agent_node_materialize_remove_failed',
  add: 'agent_node_materialize_add_failed',
  configure: 'agent_node_materialize_configure_failed'
}

function createAdapterNode(
  graph: MaterializableGraph,
  state: NodeState
): LGraphNode | undefined {
  try {
    return LiteGraph.createNode(state.type, state.title) ?? missingNode(state)
  } catch (cause) {
    reportError(cause, {
      errorType: 'agent_node_materialize_create_failed',
      context: { graphId: graph.id, nodeId: String(state.id) }
    })
    return undefined
  }
}

interface StoreWidgetSnapshot {
  storedValues: Map<string, WidgetValue>
  placeholderWidgetNames: string[]
}

function snapshotStoreWidgets(
  scope: GraphScope,
  state: NodeState,
  orphan: LGraphNode | undefined
): StoreWidgetSnapshot {
  const stored = useWidgetValueStore().getNodeWidgets(
    scope.rootGraphId,
    state.id
  )
  return {
    storedValues: new Map(stored.map((widget) => [widget.name, widget.value])),
    placeholderWidgetNames:
      orphan?.constructor === LGraphNode
        ? (orphan.widgets ?? []).map((widget) => widget.name)
        : []
  }
}

/**
 * The store owns widget values: a value written before this adapter existed
 * outranks whatever the definition restored from the snapshot.
 */
function applyStoredValues(
  node: LGraphNode,
  storedValues: Map<string, WidgetValue>
): void {
  for (const widget of node.widgets ?? []) {
    if (widget.serialize === false || widget.type === 'button') continue
    if (storedValues.has(widget.name)) {
      widget.value = storedValues.get(widget.name)
    }
  }
}

/** A placeholder's slot mirrors have no widget on the real class. */
function dropPlaceholderMirrors(
  scope: GraphScope,
  state: NodeState,
  node: LGraphNode,
  names: string[]
): void {
  const widgetStore = useWidgetValueStore()
  for (const name of names) {
    if (node.widgets?.some((widget) => widget.name === name)) continue
    widgetStore.deleteWidget(widgetId(scope.rootGraphId, state.id, name))
  }
}

/**
 * Same placeholder `LGraph.configure()` builds for an unregistered type. The
 * record it registers replaces the canonical one, so the serialisation moves
 * with it: that is what re-serialises the node and rebinds it later.
 */
function missingNode(state: NodeState): LGraphNode {
  const node = new LGraphNode(
    state.title || state.type || 'Missing Node',
    state.type
  )
  node.has_errors = true
  node.last_serialization = state.lastSerialization
  return node
}

/**
 * Op-layer serialisations carry widget values keyed by name; `configure()`
 * only reads name-keyed values from `widgets_values_named`. A partial named
 * record keeps its other slots bound by the definition's own widget order.
 */
function withNamedWidgetValues(
  serialised: ISerialisedNode,
  node: LGraphNode
): ISerialisedNode {
  const values = serialised.widgets_values
  const named = serialised.widgets_values_named
  if (values === undefined) return serialised
  if (!Array.isArray(values)) {
    return named !== undefined
      ? serialised
      : { ...serialised, widgets_values_named: values }
  }
  if (named === undefined) return serialised
  const completed = { ...named }
  const serialisable = (node.widgets ?? []).filter(
    (widget) => widget.serialize !== false
  )
  serialisable.forEach((widget, index) => {
    if (!(widget.name in completed) && index < values.length)
      completed[widget.name] = values[index]
  })
  return { ...serialised, widgets_values_named: completed }
}
