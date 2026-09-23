import { reconcileAutogrowInputs } from '@/core/graph/widgets/dynamicWidgets'
import { isRootGraphDocBound } from '@/lib/litegraph/src/docBoundGraphs'
import {
  isReservedBitRangeNodeId,
  matchesReservedBitConvention
} from '@/lib/litegraph/src/idAllocation'
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import { realignInputLinkSlots } from '@/lib/litegraph/src/linkDeduplication'
import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { materializeLinkAdapter } from '@/lib/litegraph/src/LLink'
import { topologicalSortSubgraphs } from '@/lib/litegraph/src/subgraph/subgraphDeduplication'
import type {
  ExportedSubgraph,
  ISerialisedNode
} from '@/lib/litegraph/src/types/serialisation'
import { isWidgetValue } from '@/lib/litegraph/src/types/widgets'
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
import type { WidgetStateInit } from '@/types/widgetState'

import { allSubgraphDefinitions } from './agentSubgraphDefinitions'
import { runMintPortsSuppressed } from './mintPortWiring'

const AGENT_ECS_TAGS = {
  failure_kind: 'caught_unexpected',
  feature_area: 'agent',
  operation: 'sync',
  integration_target: 'ecs',
  feature_flag: 'agent_crdt_follower',
  feature_flag_state: 'enabled',
  project_context: 'active_workflow'
}

export type MaterializableGraph = Pick<
  LGraph,
  | 'id'
  | 'rootGraph'
  | '_nodes'
  | '_nodes_by_id'
  | 'add'
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
  return runMintPortsSuppressed(() =>
    useWidgetValueStore().withLocalDirtyTrackingSuppressed(() => {
      const pending = registerSubgraphDefinitions(graph, subgraphDefinitions)
      return reconcile(graph, pending)
    })
  )
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
      tags: { ...AGENT_ECS_TAGS, outcome: 'degraded' },
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
    const live = graph._nodes_by_id[state.id]
    if (live && nodeStore.ownsNode(scope, live._state)) {
      reconcileAutogrowInputs(live)
      continue
    }
    const serialised = state.lastSerialization
    if (!serialised) continue
    if (pendingDefinitions.has(state.type)) continue
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
  for (const orphan of detached) {
    graph.remove(orphan, { preserveCanonicalState: true })
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
  reportReservedBitViolation(graph, scope, state.id)

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
      tags: {
        ...AGENT_ECS_TAGS,
        outcome: cleanupFailed ? 'degraded' : 'recovered'
      },
      context: { graphId: graph.id, nodeId: String(state.id) }
    })
    if (cleanupFailed) {
      reportError(cleanupCause, {
        errorType: 'agent_node_materialize_rollback_failed',
        tags: { ...AGENT_ECS_TAGS, outcome: 'degraded' },
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

  // Only report once the node this id now belongs to is actually live: a
  // failed add rolls the orphan back onto the id via `rollback()`/`restore()`,
  // so a report emitted before this point would claim a drop that a
  // subsequent retry then contradicts.
  reportNodeIdWriteDropped(graph, state, orphan)

  try {
    const savedInputs = serialised.inputs?.map((input) => ({ ...input }))
    node.configure(withNamedWidgetValues(serialised, widgets))
    replayUpdatedWidgetCallbacks(node, serialised, widgets)
    // After configure and any widget-driven restructuring, re-point the saved
    // links at their named inputs (CRDT-INPUTS-0030).
    realignInputLinkSlots(graph.rootGraph, [
      [node.id, { id: node.id, inputs: savedInputs }]
    ])
  } catch (cause) {
    // The node is attached and consistent with the stores; removing it here
    // would also drop the layout entry it adopted. Keep it and report.
    reportError(cause, {
      errorType: 'agent_node_materialize_configure_failed',
      tags: { ...AGENT_ECS_TAGS, outcome: 'degraded' },
      context: { graphId: graph.id, nodeId: String(state.id) }
    })
  }
  return true
}

/**
 * The disjoint-mint partition (`idAllocation.ts`'s `AGENT_RESERVED_BIT`)
 * rests on comfy-cli's `mint_id()` always setting bit 40 — a premise this
 * repo cannot verify and comfy-cli could change without notice. Surface a
 * remote id that carries NEITHER reserved bit (on a doc-bound graph, at the
 * size only a modern mint produces) as telemetry instead of leaving the
 * partition to silently stop holding.
 *
 * Only a numeric integer id says anything here: string ids are legal
 * (`NodeId` is `string | number`, and a bound doc can carry a legacy
 * `"named"` node or a `"57:3"` subgraph address), predate both mints, and
 * are not `BigInt`-convertible — reconciliation must not abort on one.
 */
function reportReservedBitViolation(
  graph: MaterializableGraph,
  scope: GraphScope,
  nodeId: NodeId
): void {
  if (!isRootGraphDocBound(scope.rootGraphId)) return
  if (!isReservedBitRangeNodeId(nodeId)) return
  if (matchesReservedBitConvention(nodeId)) return
  reportError(
    new Error(
      `Remote node id ${String(nodeId)} on a CRDT-bound graph carries neither reserved mint bit (the agent's nor this app's)`
    ),
    {
      errorType: 'agent_node_id_reserved_bit_violation',
      tags: { ...AGENT_ECS_TAGS, outcome: 'degraded' },
      context: { graphId: graph.id, nodeId: String(nodeId) }
    }
  )
}

/**
 * Node ids already reported as a dropped write for their current live/doc
 * class pairing, per root graph, so a reconcile frame that keeps re-deriving
 * the same orphan across many frames reports it once rather than on every
 * frame it remains unresolved.
 */
const reportedNodeIdCollisions = new WeakMap<LGraph, Set<NodeId>>()

/** Bound on a class name read from the shared doc before it reaches
 * telemetry, so a peer cannot inflate the report or inject fake log lines
 * into it through an oversized or newline-bearing `type`. */
const MAX_REPORTED_CLASS_NAME_LENGTH = 200

function sanitizeClassNameForTelemetry(value: string): string {
  const collapsed = value.replace(/[\r\n]+/g, ' ')
  return collapsed.length > MAX_REPORTED_CLASS_NAME_LENGTH
    ? `${collapsed.slice(0, MAX_REPORTED_CLASS_NAME_LENGTH)}…`
    : collapsed
}

/**
 * A node id's class is fixed by the `add_node` that claimed it: the op
 * vocabulary has no retype, so nothing can legally change the class at a live
 * id through an ordinary edit. A class change here most often means the
 * document resolved two `add_node` writes sharing an id as last-write-wins
 * and dropped the loser with no error to either actor — but the same shape
 * (a live node at this id whose class no longer matches the record) can also
 * come from a legitimate `remove_node` + `add_node` pair reusing the id, a
 * retype, or a stale-canvas catch-up reconcile that observes both changes at
 * once. This function has no op provenance to tell those apart, so it is a
 * heuristic, not a confirmed diagnosis: treat the report as "this id's class
 * changed under our feet", not as proof a write was lost.
 *
 * `orphan` is the live node at this id that is no longer owned by the record
 * the document now holds for it. Comparing its class to the record's is the
 * only trace of a genuine drop this client gets, since the ack counts an
 * LWW-dropped op as applied and the applier's own conflict event fires
 * host-side.
 */
function reportNodeIdWriteDropped(
  graph: MaterializableGraph,
  state: NodeState,
  orphan: LGraphNode | undefined
): void {
  const rootGraph = graph.rootGraph
  const reported =
    reportedNodeIdCollisions.get(rootGraph) ??
    reportedNodeIdCollisions.set(rootGraph, new Set()).get(rootGraph)!

  if (!orphan || orphan.type === state.type) {
    reported.delete(state.id)
    return
  }
  if (reported.has(state.id)) return
  reported.add(state.id)

  const liveClass = sanitizeClassNameForTelemetry(orphan.type)
  const docClass = sanitizeClassNameForTelemetry(state.type)
  reportError(
    new Error(
      `Node id ${String(state.id)} changed class from ${liveClass} to ${docClass} at the same id`
    ),
    {
      errorType: 'agent_node_id_collision_write_dropped',
      tags: { ...AGENT_ECS_TAGS, outcome: 'degraded' },
      context: {
        graphId: graph.id,
        nodeId: String(state.id),
        liveClass,
        docClass
      }
    }
  )
}

function replayUpdatedWidgetCallbacks(
  node: LGraphNode,
  serialised: ISerialisedNode,
  widgets: readonly WidgetStateInit[]
): void {
  const values = namedWidgetValues(serialised)
  if (!values) return
  const canonicalByName = new Map(
    widgets.flatMap((state) => (state.name ? [[state.name, state]] : []))
  )
  for (const [name, state] of canonicalByName) {
    const previousValue = values[name]
    if (Object.hasOwn(values, name) && Object.is(previousValue, state.value)) {
      continue
    }
    const widget = node.widgets?.find((candidate) => candidate.name === name)
    if (!widget) continue
    widget.value = state.value
    widget.callback?.(state.value)
    node.onWidgetChanged?.(name, state.value, previousValue, widget)
  }
}

function namedWidgetValues(
  serialised: ISerialisedNode
): Record<string, WidgetValue> | undefined {
  const values = serialised.widgets_values_named ?? serialised.widgets_values
  if (!values || Array.isArray(values) || typeof values !== 'object') return
  const entries = Object.entries(values)
  return entries.every(([, value]) => isWidgetValue(value))
    ? Object.fromEntries(entries)
    : undefined
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
function withNamedWidgetValues(
  serialised: ISerialisedNode,
  widgets: readonly WidgetStateInit[]
): ISerialisedNode {
  const namedValues = namedWidgetValues(serialised)
  if (!namedValues) return serialised
  return {
    ...serialised,
    widgets_values_named: {
      ...namedValues,
      ...Object.fromEntries(
        widgets.map((widget) => [widget.name ?? '', widget.value])
      )
    }
  }
}
