import type { LGraph, Subgraph } from '@/lib/litegraph/src/LGraph'
import { materializeLinkAdapter } from '@/lib/litegraph/src/LLink'
import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import {
  demoteWidget,
  promoteWidget,
  reorderSubgraphInputsByName
} from '@/core/graph/subgraph/promotionUtils'
import { SUBGRAPH_INPUT_ID } from '@/lib/litegraph/src/constants'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
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
import { toNodeId } from '@/types/nodeId'
import type { NodeState } from '@/types/nodeState'
import { widgetId } from '@/types/widgetId'
import type { WidgetStateInit } from '@/types/widgetState'

import { ambiguousInputNames } from './agentSubgraphHostSlots'
import { runMintPortsSuppressed } from './mintPortWiring'

export type MaterializableGraph = Pick<
  LGraph,
  'id' | 'rootGraph' | '_nodes' | '_nodes_by_id' | 'add' | 'remove'
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
    const materialized = reconcile(graph, pending)
    reconcileSubgraphPromotions(graph.rootGraph, subgraphDefinitions)
    return materialized
  })
}

interface PromotionSource {
  node: LGraphNode
  widget: NonNullable<LGraphNode['widgets']>[number]
  boundaryName: string
}

function promotionKey(
  node: LGraphNode,
  widget: PromotionSource['widget'],
  boundaryName: string
) {
  return `${node.id}\u0000${widget.name}\u0000${boundaryName}`
}

interface PromotionLink {
  originId: unknown
  targetId: unknown
  targetSlot: number
}

function promotionLinks(
  definition: ExportedSubgraph
): Map<number, PromotionLink> | Error {
  const links = new Map<number, PromotionLink>()
  for (const link of definition.links ?? []) {
    const tuple: unknown = link
    const id = Number(Array.isArray(tuple) ? tuple[0] : link.id)
    const targetSlot = Number(
      Array.isArray(tuple) ? tuple[4] : link.target_slot
    )
    if (!Number.isFinite(id) || !Number.isInteger(targetSlot)) {
      return new Error(
        `Agent subgraph promotion link is malformed: ${definition.id}`
      )
    }
    links.set(id, {
      originId: Array.isArray(tuple) ? tuple[1] : link.origin_id,
      targetId: Array.isArray(tuple) ? tuple[3] : link.target_id,
      targetSlot
    })
  }
  return links
}

function resolvePromotionSources(
  subgraph: Subgraph,
  definition: ExportedSubgraph
): PromotionSource[] | Error {
  const links = promotionLinks(definition)
  if (links instanceof Error) return links
  const sources: PromotionSource[] = []
  const ambiguous = ambiguousInputNames(definition)
  for (const input of definition.inputs ?? []) {
    if (ambiguous.has(input.name)) continue
    const inputSources: PromotionSource[] = []
    for (const linkId of input.linkIds ?? []) {
      const link = links.get(linkId)
      if (!link) {
        return new Error(
          `Agent subgraph promotion link is unknown: ${definition.id}/${String(linkId)}/${input.name}`
        )
      }
      if (String(link.originId) !== SUBGRAPH_INPUT_ID) continue
      const node = subgraph.getNodeById(toNodeId(String(link.targetId)))
      const slot = node?.inputs[link.targetSlot]
      if (!node || !slot) {
        return new Error(
          `Agent subgraph promotion source is unknown: ${definition.id}/${String(link.targetId)}/${input.name}`
        )
      }
      const widget = node.getWidgetFromSlot(slot)
      if (widget) inputSources.push({ node, widget, boundaryName: input.name })
    }
    const source = inputSources.at(0)
    if (inputSources.length === 1 && source) sources.push(source)
  }
  return sources
}

function currentPromotionSources(subgraph: Subgraph): PromotionSource[] {
  return subgraph.inputs.flatMap((input) =>
    input.linkIds.flatMap((linkId) => {
      const link = subgraph.getLink(linkId)
      if (!link) return []
      const { inputNode, input: targetInput } = link.resolve(subgraph)
      const widget = targetInput
        ? inputNode?.getWidgetFromSlot(targetInput)
        : undefined
      return inputNode && targetInput && widget
        ? [{ node: inputNode, widget, boundaryName: input.name }]
        : []
    })
  )
}

function definitionHosts(rootGraph: LGraph, definitionId: string) {
  const graphs = [rootGraph, ...rootGraph.subgraphs.values()]
  return graphs.flatMap((candidate) =>
    candidate.nodes.filter(
      (node): node is SubgraphNode =>
        node.isSubgraphNode() && node.type === definitionId
    )
  )
}

const knownPromotionBoundaryNames = new WeakMap<Subgraph, Set<string>>()

function stalePromotionBoundaryNames(
  subgraph: Subgraph,
  definition: ExportedSubgraph
): Set<string> {
  const stale = new Set<string>()
  const known = knownPromotionBoundaryNames.get(subgraph) ?? new Set()
  const definitionNodeIds = new Set(
    (definition.nodes ?? []).map(({ id }) => String(id))
  )
  const links = promotionLinks(definition)
  if (links instanceof Error) return stale

  for (const input of definition.inputs ?? []) {
    if (!known.has(input.name)) continue
    for (const linkId of input.linkIds ?? []) {
      const link = links.get(linkId)
      if (!link || String(link.originId) !== SUBGRAPH_INPUT_ID) continue
      const node = subgraph.getNodeById(toNodeId(String(link.targetId)))
      const slot = node?.inputs[link.targetSlot]
      if (
        !definitionNodeIds.has(String(link.targetId)) ||
        !node ||
        !slot ||
        !node.getWidgetFromSlot(slot)
      ) {
        stale.add(input.name)
      }
    }
  }
  return stale
}

function removeStalePromotedInputs(
  subgraph: Subgraph,
  hosts: SubgraphNode[],
  staleBoundaryNames: ReadonlySet<string>
): void {
  for (const subgraphInput of [...subgraph.inputs]) {
    if (!staleBoundaryNames.has(subgraphInput.name)) continue
    const hostInputs = hosts.flatMap((host) => {
      const input = host.inputs.find(
        (candidate) => candidate._subgraphSlot === subgraphInput
      )
      return input ? [{ host, input }] : []
    })

    for (const { host, input } of hostInputs) {
      const inputIndex = host.inputs.indexOf(input)
      if (host.isInputConnected(inputIndex)) host.disconnectInput(inputIndex)
    }
    subgraph.removeInput(subgraphInput)
    for (const { input } of hostInputs) {
      if (input.widgetId) useWidgetValueStore().deleteWidget(input.widgetId)
    }
  }
}

const reportedPromotionFailures = new WeakMap<LGraph, Map<string, string>>()

function reconcileSubgraphPromotions(
  rootGraph: LGraph,
  definitions: ExportedSubgraph[]
): void {
  const reported =
    reportedPromotionFailures.get(rootGraph) ??
    reportedPromotionFailures.set(rootGraph, new Map()).get(rootGraph)!
  const flattened = flattenDefinitions(definitions)
  for (const definition of topologicalSortSubgraphs(flattened)) {
    const live = rootGraph.subgraphs.get(definition.id)
    if (!live) continue
    const hosts = definitionHosts(rootGraph, definition.id)
    const declaredBoundaryNames = new Set(
      (definition.inputs ?? []).map(({ name }) => name)
    )
    const staleBoundaryNames = stalePromotionBoundaryNames(live, definition)
    for (const input of live.inputs) {
      if (
        knownPromotionBoundaryNames.get(live)?.has(input.name) &&
        !declaredBoundaryNames.has(input.name)
      ) {
        staleBoundaryNames.add(input.name)
      }
    }
    removeStalePromotedInputs(live, hosts, staleBoundaryNames)
    const known = knownPromotionBoundaryNames.get(live)
    for (const name of staleBoundaryNames) known?.delete(name)

    const desired = resolvePromotionSources(live, definition)
    if (desired instanceof Error) {
      if (reported.get(definition.id) !== desired.message) {
        reported.set(definition.id, desired.message)
        reportError(desired, {
          errorType: 'agent_subgraph_promotion_failed',
          context: { graphId: rootGraph.id, definitionId: definition.id }
        })
      }
      continue
    }

    reported.delete(definition.id)
    knownPromotionBoundaryNames.set(
      live,
      new Set(desired.map(({ boundaryName }) => boundaryName))
    )

    if (hosts.length === 0) continue
    const desiredKeys = new Set(
      desired.map(({ node, widget, boundaryName }) =>
        promotionKey(node, widget, boundaryName)
      )
    )
    const current = currentPromotionSources(live)
    const currentKeys = new Set(
      current.map(({ node, widget, boundaryName }) =>
        promotionKey(node, widget, boundaryName)
      )
    )
    for (const { node, widget, boundaryName } of current) {
      if (!desiredKeys.has(promotionKey(node, widget, boundaryName))) {
        demoteWidget(node, widget, hosts)
      }
    }
    for (const { node, widget, boundaryName } of desired) {
      if (currentKeys.has(promotionKey(node, widget, boundaryName))) continue
      const sourceName = widget.name
      widget.name = boundaryName
      try {
        for (const failure of promoteWidget(node, widget, hosts)) {
          const error = new Error(
            `Agent subgraph promotion failed: ${definition.id}/${String(failure.host.id)}/${boundaryName}/${failure.reason}`
          )
          reportError(error, {
            errorType: 'agent_subgraph_promotion_failed',
            context: {
              graphId: rootGraph.id,
              definitionId: definition.id,
              hostId: failure.host.id,
              reason: failure.reason
            }
          })
        }
      } finally {
        widget.name = sourceName
      }
    }
    for (const host of hosts) {
      reorderSubgraphInputsByName(
        host,
        (definition.inputs ?? []).map(({ name }) => name)
      )
    }
  }
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
  const missing = flattenDefinitions(definitions).filter(
    (definition) => !rootGraph.subgraphs.has(definition.id)
  )
  const pending = new Set(missing.map((definition) => definition.id))
  if (missing.length === 0) return pending

  const reported =
    reportedDefinitionFailures.get(rootGraph) ??
    reportedDefinitionFailures.set(rootGraph, new Set()).get(rootGraph)!

  for (const definition of topologicalSortSubgraphs(missing)) {
    const failure = tryCreateSubgraph(
      rootGraph,
      withoutAmbiguousBoundaryInputs(definition)
    )
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

function withoutAmbiguousBoundaryInputs(
  definition: ExportedSubgraph
): ExportedSubgraph {
  const ambiguous = ambiguousInputNames(definition)
  if (ambiguous.size === 0) return definition
  const omittedLinkIds = new Set(
    (definition.inputs ?? [])
      .filter((input) => ambiguous.has(input.name))
      .flatMap((input) => input.linkIds ?? [])
  )
  return {
    ...definition,
    inputs: (definition.inputs ?? []).filter(
      (input) => !ambiguous.has(input.name)
    ),
    links: (definition.links ?? []).filter(
      (link) => !omittedLinkIds.has(link.id)
    )
  }
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
 * Each definition plus every definition nested under its `definitions`, with
 * the nesting stripped so each one registers on its own.
 */
function flattenDefinitions(
  definitions: ExportedSubgraph[]
): ExportedSubgraph[] {
  return definitions.flatMap((definition) => [
    { ...definition, definitions: undefined },
    ...flattenDefinitions(definition.definitions?.subgraphs ?? [])
  ])
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
    if (live && nodeStore.ownsNode(scope, live._state)) continue
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
