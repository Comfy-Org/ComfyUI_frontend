/**
 * Mints the bound document's semantic operations from graph intents: the
 * commands litegraph announces at its own API funnels (`graphIntents.ts`),
 * each tagged with provenance. Only `local` intents mint; `load` and
 * `agent-remote` are skipped by that field, never inferred.
 *
 * Intents are collected synchronously and enqueued together at the end of
 * the tick, in command order. Only `add_node` reads anything at that point:
 * paste adds a node and then configures it, so the snapshot waits for the
 * command's own tick to finish. A node added and removed in one tick mints
 * nothing, and neither do the links it was wired with in between; a widget
 * write on a node whose add is still pending is already in that snapshot.
 */
import type {
  NodeId as WireNodeId,
  PromotedHostWrite,
  WorkflowNode
} from '@comfyorg/comfy-multi-player'

import { liveAutogrowGroupOf } from '@/core/graph/widgets/dynamicWidgets'
import { registerDocBoundRootGraphProbe } from '@/lib/litegraph/src/docBoundGraphs'
import {
  onGraphIntent,
  withGraphIntentSource
} from '@/lib/litegraph/src/graphIntents'
import type { GraphIntentEvent } from '@/lib/litegraph/src/graphIntents'
import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { LLink } from '@/lib/litegraph/src/LLink'
import type { Subgraph } from '@/lib/litegraph/src/subgraph/Subgraph'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import { isWidgetValue } from '@/lib/litegraph/src/types/widgets'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { reportError } from '@/platform/telemetry/reportError'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toRootGraphId } from '@/types/graphScopeId'
import type { RootGraphId } from '@/types/graphScopeId'
import type { NodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import type { WidgetId } from '@/types/widgetId'
import type { WidgetState } from '@/types/widgetState'
import {
  findNodeInHierarchy,
  findSubgraphByUuid,
  findSubgraphNodePathById,
  traverseSubgraphPath
} from '@/utils/graphTraversalUtil'

import type { GraphOperation } from './graphOperations'
import { WIRE_MAX_BATCH_BYTES } from './opEnvelope'
import type { DocPromotedWidgets } from './agentSubgraphDefinitions'

export interface DocOpMinterDeps {
  /** Slice 00's product gate. */
  isEnabled(): boolean
  /** A semantic doc is bound for the active workflow. */
  isDocBound(): boolean
  /** Receives minted semantic operations (the sender's inbox). */
  enqueue(operations: GraphOperation[]): void
  /** The live root graph, or null when no workflow is open. */
  getGraph(): LGraph | null
  /** Stable identity of the semantic document currently bound to the minter. */
  boundWorkflowId(): string | null
  /**
   * The bound workflow's own stored root graph id, or null when no workflow
   * is bound. Read from the workflow's serialized state rather than the live
   * canvas graph, so it names the bound document's graph even while a tab
   * switch is loading another workflow into the shared canvas graph.
   */
  boundRootGraphId(): RootGraphId | null
  /**
   * The bound document's input slot names for a node, in document order, or
   * null when the document holds no such node (its `add_node` is still in
   * flight, or no document is subscribed).
   */
  docInputNames(nodeId: NodeId): readonly (string | undefined)[] | null
  /**
   * The bound document's view of a node's promoted widget layout, or null
   * when the document holds no such node.
   */
  docPromotedWidgets(nodeId: NodeId): DocPromotedWidgets | null
  /** A local widget changed live but cannot be represented safely in the doc. */
  onWidgetWriteRefused?(write: {
    nodeId: NodeId
    name: string
    reason:
      | 'layout_drift'
      | 'nested_host'
      | 'unpromoted_host_widget'
      | 'unresolvable_owner'
      | 'unsafe_value'
  }): void
}

export interface DocOpMinter {
  detach(): void
}

type IntentOf<T extends GraphIntentEvent['type']> = Extract<
  GraphIntentEvent,
  { type: T }
>

type WidgetRefusalReason =
  | 'layout_drift'
  | 'nested_host'
  | 'unpromoted_host_widget'
  | 'unresolvable_owner'
  | 'unsafe_value'

interface MintedWidgetBase {
  op: 'set_widget'
  node_id: NodeId
  widget: string
  value: unknown
  old?: unknown
}

const REFUSAL_NOTIFICATION_INTERVAL_MS = 5000
// Identity fields are small today, but leave enough headroom that a semantic
// op accepted here remains below the transport cap after the sender adds its
// actor, Lamport stamp and UUID.
const WIRE_ENVELOPE_RESERVE_BYTES = 64 * 1024
type PendingOpPayload =
  | { kind: 'add_node'; graph: LGraph; node: LGraphNode }
  | { kind: 'op'; operation: GraphOperation }

type PendingOp = PendingOpPayload & { binding: string | null }
type MaterializedPending = {
  entry: PendingOp
  operation: GraphOperation | null
}

/**
 * Serialized save-format node. `widgets_values` is NAME-KEYED via the node's
 * own `widgets_values_named` minus non-value widgets (FE-1904: the doc host's
 * sidecar projection accepts only the pinned catalog's `widget_order` names;
 * control widgets like a `button` serialize a named entry but are not in
 * `widget_order`, and any extra key is an opaque server-side 500).
 *
 * A frontend-only class (`isVirtualNode`: Note, MarkdownNote, PrimitiveNode,
 * Get/Set nodes from node packs, subgraph blueprint hosts) has no catalog
 * entry. The applier rejects a name-keyed record for such a class
 * (`uncatalogued_widget_write`) but stores a positional array opaquely, so
 * those keep the positional form `serialize()` already produced.
 *
 * `flags.ghost` is a placement-in-progress marker the placement click clears
 * without minting, so the document must not record it.
 */
export function wireNodeSnapshot(node: LGraphNode): WorkflowNode | null {
  let serialized: ISerialisedNode
  try {
    serialized = node.serialize()
  } catch {
    return null
  }
  const wireSerialized = { ...serialized }
  Reflect.deleteProperty(wireSerialized, '__incarnation')
  const {
    widgets_values_named: named,
    flags: { ghost: _ghost, ...flags },
    ...rest
  } = wireSerialized
  const snapshot = { ...rest, flags } satisfies WorkflowNode
  return named && !node.isVirtualNode
    ? { ...snapshot, widgets_values: valueWidgetsOnly(node, named) }
    : snapshot
}

function valueWidgetsOnly(
  node: LGraphNode,
  named: object
): Record<string, unknown> {
  const filtered: Record<string, unknown> = {}
  const rootGraphId = node.graph?.rootGraph.id
  const widgetValueStore = useWidgetValueStore()
  for (const [name, value] of Object.entries(named)) {
    const widget = node.widgets?.find((candidate) => candidate.name === name)
    const stored = rootGraphId
      ? widgetValueStore.getWidget(widgetId(rootGraphId, node.id, name))
      : undefined
    if (isValueWidget(widget, stored)) filtered[name] = value
  }
  return filtered
}

function isValueWidget(
  widget: IBaseWidget | undefined,
  stored?: WidgetState
): boolean {
  if (!widget && !stored) return false
  // A destructuring default fires on absent AND present-but-undefined alike,
  // which is what `IBaseWidget`'s own optional fields mean: the live widget
  // did not state this, so the registration the intent was keyed by answers.
  // One construct for both fields, so the two halves of the guard cannot
  // drift apart again.
  const { type = stored?.type, serialize = stored?.serialize } = widget ?? {}
  return type !== 'button' && serialize !== false
}

function nodeKey(graphId: string, nodeId: NodeId): string {
  return `${graphId}:${String(nodeId)}`
}

function reachableIntentGraph(
  graph: LGraph,
  graphId: string
): LGraph | Subgraph | null {
  if (graphId === graph.id) return graph
  const registered = findSubgraphByUuid(graph, graphId)
  if (registered) return registered
  const path = findSubgraphNodePathById(graph, graphId)
  return path ? traverseSubgraphPath(graph, path) : null
}

/**
 * Whether the live widget, or the store metadata the intent was keyed by when
 * the live widget is missing or omits a field, identifies a value the document
 * carries. Unknown widgets fail closed.
 */
function isValueWidgetWrite(
  owner: LGraphNode | null,
  event: IntentOf<'set_widget'>
): boolean {
  const rootGraphId = owner?.graph?.rootGraph.id ?? event.graphId
  const stored = useWidgetValueStore().getWidget(
    widgetId(rootGraphId, event.nodeId, event.name)
  )
  const widget = owner?.widgets?.find(
    (candidate) => candidate.name === event.name
  )
  return isValueWidget(widget, stored)
}

/**
 * The positional payload a write to a PROMOTED widget needs (schema Amendment
 * A15). A subgraph instance's `type` is a definition UUID, so the pinned
 * catalog never describes it and the document stores its promoted values as
 * one opaque positional array (schema §1.2) that no name can address: a named
 * `set_widget` against such a node is rejected outright (`opaque_widgets`),
 * which bounced edits to a promoted widget while the agent held the document
 * (PM-1995). A host nested inside another definition still takes the interior
 * route below and is still refused.
 *
 * `value_index` is the widget's position among the node's widget-backed
 * inputs — the order `SubgraphNode.serialize` builds `widgets_values` in and
 * the order `applyHostWidgets` reads it back in. The document is consulted
 * only to REFUSE a write it would misplace, never as the index itself: its
 * `inputs` mirror can widget-mark fewer slots than `widgets_values` has
 * entries, so an index taken from it lands on another widget's value.
 */
function promotedHostWrite(
  node: LGraphNode | null,
  event: IntentOf<'set_widget'>,
  docPromotedWidgets: () => DocPromotedWidgets | null,
  onOrderDrift: (
    names: readonly string[],
    doc: DocPromotedWidgets | null
  ) => void,
  onUnpromotedWidget: () => void,
  onUnsafeSnapshot: () => void
): PromotedHostWrite | null {
  if (!node?.isSubgraphNode()) return null
  const hostInputs = node.inputs.flatMap((input) =>
    input.widgetId ? [{ name: input.name, widgetId: input.widgetId }] : []
  )
  const valueIndex = hostInputs.findIndex((input) => input.name === event.name)
  const liveNames = hostInputs.map((input) => input.name)
  if (valueIndex === -1) {
    onUnpromotedWidget()
    return null
  }
  const doc = docPromotedWidgets()
  if (
    new Set(liveNames).size !== liveNames.length ||
    !documentAcceptsLiveIndex(doc, liveNames)
  ) {
    onOrderDrift(liveNames, doc)
    return null
  }
  const hostWidgetsValues = promotedHostSnapshot(
    hostInputs,
    valueIndex,
    event.value,
    onUnsafeSnapshot
  )
  if (hostWidgetsValues === null) return null
  return {
    value_index: valueIndex,
    instance_path: [String(event.nodeId)],
    host_widgets_values: hostWidgetsValues
  }
}

function promotedHostSnapshot(
  hostInputs: readonly { name: string; widgetId: WidgetId }[],
  valueIndex: number,
  eventValue: unknown,
  onUnsafeSnapshot: () => void
): unknown[] | null {
  const widgetValueStore = useWidgetValueStore()
  try {
    const hostWidgetsValues: unknown[] = []
    for (const [index, input] of hostInputs.entries()) {
      if (index === valueIndex) {
        hostWidgetsValues.push(eventValue)
        continue
      }
      const state = widgetValueStore.getWidget(input.widgetId)
      if (!state) {
        onUnsafeSnapshot()
        return null
      }
      const stateValue = state.value
      hostWidgetsValues.push(isWidgetValue(stateValue) ? stateValue : undefined)
    }
    const snapshot = jsonWireSnapshot(hostWidgetsValues)
    if (!snapshot.ok || !Array.isArray(snapshot.value)) {
      onUnsafeSnapshot()
      return null
    }
    const json = JSON.stringify(snapshot.value)
    if (new TextEncoder().encode(json).length > WIRE_MAX_BATCH_BYTES) {
      onUnsafeSnapshot()
      return null
    }
    return snapshot.value
  } catch {
    onUnsafeSnapshot()
    return null
  }
}

/**
 * Whether a live index is a safe index into the document's array.
 *
 * Two independent ways it is not, and the document answers both:
 *
 * - The array is sized for a different set of widgets. Checked against
 *   `valueCount`, the same cardinality invariant `applyHostWidgets` enforces
 *   on the way in.
 * - The promoted name sequence is different. Definition order combined with
 *   the instance's stored input mirror identifies the exact names behind the
 *   positional array, catching same-cardinality demote/promote swaps as well
 *   as `reorderSubgraphInputsByWidgetOrder` permutations.
 *
 * A document holding no array yet is sized by nothing, but it is NOT ordered
 * by nothing: the first write seeds the whole array from `host_widgets_values`
 * in live order, and a reload reads it back in the DEFINITION's order
 * (`_applyPromotedWidgetValues`). A reorder permutes the live definition
 * without minting, so the document's copy still holds the old order — seeding
 * against it would land every value on a neighbour. Only a document that
 * declares no definition at all leaves the live order unopposed.
 *
 * A refused write is dropped before enqueue so its `opaque_widgets` rejection
 * cannot abort unrelated operations in the same batch.
 */
function documentAcceptsLiveIndex(
  doc: DocPromotedWidgets | null,
  liveNames: readonly string[]
): boolean {
  if (doc === null) return false
  const namesMatch =
    doc.promotedNames != null &&
    doc.promotedNames.length === liveNames.length &&
    doc.promotedNames.every((name, index) => name === liveNames[index])
  if (doc.valueCount === 0) return namesMatch
  return doc.valueCount === liveNames.length && namesMatch
}

function topLevelWidgetOperation(
  operation: MintedWidgetBase,
  node: LGraphNode,
  event: IntentOf<'set_widget'>,
  docPromotedWidgets: () => DocPromotedWidgets | null,
  onOrderDrift: (
    names: readonly string[],
    doc: DocPromotedWidgets | null
  ) => void,
  onRefused: (reason: WidgetRefusalReason) => void,
  onUnsafeSnapshot: () => void
): GraphOperation | null {
  if (!node.isSubgraphNode()) return operation
  const promoted = promotedHostWrite(
    node,
    event,
    docPromotedWidgets,
    onOrderDrift,
    () => onRefused('unpromoted_host_widget'),
    onUnsafeSnapshot
  )
  return promoted ? { ...operation, promoted } : null
}

function interiorWidgetOperation(
  graph: LGraph,
  operation: MintedWidgetBase,
  event: IntentOf<'set_widget'>,
  node: LGraphNode,
  owningGraphId: string,
  onRefused: (reason: WidgetRefusalReason) => void
): GraphOperation | null {
  if (node.isSubgraphNode()) {
    onRefused('nested_host')
    return null
  }
  const subgraphNodePath = findSubgraphNodePathById(graph, owningGraphId)
  if (subgraphNodePath === null || subgraphNodePath.length === 0) {
    console.error(
      '[agent-crdt] set_widget with an unresolvable owner not minted; the bound doc diverges from the local graph',
      nodeKey(owningGraphId, event.nodeId) + `:${event.name}`
    )
    onRefused('unresolvable_owner')
    return null
  }
  const [head, ...rest] = subgraphNodePath
  return {
    ...operation,
    path: [head, ...rest, String(event.nodeId)],
    inner_widget: event.name
  }
}

function routedWidgetOperation(
  graph: LGraph,
  rootGraphId: string,
  event: IntentOf<'set_widget'>,
  node: LGraphNode | null,
  docPromotedWidgets: () => DocPromotedWidgets | null,
  onOrderDrift: (
    names: readonly string[],
    doc: DocPromotedWidgets | null
  ) => void,
  onRefused: (reason: WidgetRefusalReason) => void,
  onUnsafeSnapshot: () => void
): GraphOperation | null {
  const value = jsonWireSnapshot(event.value)
  if (!value.ok) {
    onUnsafeSnapshot()
    return null
  }
  const previous = jsonWireSnapshot(event.previous)
  const operation = {
    op: 'set_widget',
    node_id: event.nodeId,
    widget: event.name,
    value: value.value,
    ...(previous.ok ? { old: previous.value } : {})
  } as const
  if (node === null) {
    onRefused('unresolvable_owner')
    return null
  }
  const owningGraphId = node.graph?.id ?? event.graphId
  if (owningGraphId === rootGraphId) {
    return fitWidgetOperation(
      topLevelWidgetOperation(
        operation,
        node,
        { ...event, value: value.value },
        docPromotedWidgets,
        onOrderDrift,
        onRefused,
        onUnsafeSnapshot
      ),
      onUnsafeSnapshot
    )
  }
  return fitWidgetOperation(
    interiorWidgetOperation(
      graph,
      operation,
      event,
      node,
      owningGraphId,
      onRefused
    ),
    onUnsafeSnapshot
  )
}

function fitWidgetOperation(
  operation: GraphOperation | null,
  onUnsafeSnapshot: () => void
): GraphOperation | null {
  if (operation === null || operationFitsWire(operation)) return operation
  onUnsafeSnapshot()
  return null
}

type WireSnapshot = { ok: true; value: unknown } | { ok: false }

function isLosslessJsonArray(
  source: readonly unknown[],
  snapshot: object
): boolean {
  return (
    Array.isArray(snapshot) &&
    source.length === snapshot.length &&
    source.every((value, index) =>
      isLosslessJsonSnapshot(value, snapshot[index])
    )
  )
}

function isLosslessJsonRecord(
  source: Record<string, unknown>,
  snapshot: object
): boolean {
  if (Array.isArray(snapshot)) return false
  const snapshotRecord = snapshot as Record<string, unknown>
  const sourceKeys = Object.keys(source)
  return (
    sourceKeys.length === Object.keys(snapshotRecord).length &&
    sourceKeys.every(
      (key) =>
        Object.hasOwn(snapshotRecord, key) &&
        isLosslessJsonSnapshot(source[key], snapshotRecord[key])
    )
  )
}

function isLosslessJsonSnapshot(source: unknown, snapshot: unknown): boolean {
  if (source === null || typeof source !== 'object') {
    return Object.is(source, snapshot)
  }
  if (snapshot === null || typeof snapshot !== 'object') return false
  if (Array.isArray(source)) return isLosslessJsonArray(source, snapshot)
  return isLosslessJsonRecord(source as Record<string, unknown>, snapshot)
}

/** Capture the exact JSON value now, before a mutable widget can change it. */
function jsonWireSnapshot(value: unknown): WireSnapshot {
  try {
    const json = JSON.stringify(value)
    const snapshot = JSON.parse(json) as unknown
    return isLosslessJsonSnapshot(value, snapshot)
      ? { ok: true, value: snapshot }
      : { ok: false }
  } catch {
    return { ok: false }
  }
}

function operationFitsWire(operation: GraphOperation): boolean {
  try {
    const json = JSON.stringify(operation)
    return (
      typeof json === 'string' &&
      new TextEncoder().encode(json).length <=
        WIRE_MAX_BATCH_BYTES - WIRE_ENVELOPE_RESERVE_BYTES
    )
  } catch {
    return false
  }
}

function failedAddNodeIds(
  materialized: readonly MaterializedPending[],
  binding: string
): Set<WireNodeId> {
  return new Set(
    materialized.flatMap(({ entry, operation }) =>
      entry.binding === binding &&
      entry.kind === 'add_node' &&
      operation === null
        ? [entry.node.id]
        : []
    )
  )
}

function failedConnectIds(
  materialized: readonly MaterializedPending[],
  failedAdds: ReadonlySet<WireNodeId>
): Set<WireNodeId> {
  return new Set(
    materialized.flatMap(({ operation }) =>
      operation?.op === 'connect' &&
      (failedAdds.has(operation.from_node) || failedAdds.has(operation.to_node))
        ? [operation.link_id]
        : []
    )
  )
}

function survivesFailedAdd(
  operation: GraphOperation,
  failedAdds: ReadonlySet<WireNodeId>,
  failedLinks: ReadonlySet<WireNodeId>
): boolean {
  if (operation.op === 'connect') return !failedLinks.has(operation.link_id)
  if (operation.op !== 'disconnect') return true
  return (
    !failedAdds.has(operation.to_node) && !failedLinks.has(operation.link_id)
  )
}

function withoutFailedAddDependents(
  materialized: readonly MaterializedPending[],
  binding: string
): GraphOperation[] {
  const failedAdds = failedAddNodeIds(materialized, binding)
  const failedLinks = failedConnectIds(materialized, failedAdds)
  return materialized.flatMap(({ operation }) =>
    operation && survivesFailedAdd(operation, failedAdds, failedLinks)
      ? [operation]
      : []
  )
}

/**
 * Drops a same-tick pending `add_node` together with every link command that
 * touched it: the doc never sees the node, so a `connect` naming it would
 * dangle, and a `disconnect` of such a link would target a link the doc
 * never had.
 */
function withoutCancelledAdd(
  pending: PendingOp[],
  nodeId: NodeId
): PendingOp[] {
  const cancelledLinkIds = new Set<WireNodeId>()
  for (const entry of pending) {
    if (entry.kind !== 'op' || entry.operation.op !== 'connect') continue
    const { from_node, to_node, link_id } = entry.operation
    if (from_node === nodeId || to_node === nodeId)
      cancelledLinkIds.add(link_id)
  }
  return pending.filter((entry) => {
    if (entry.kind === 'add_node') return entry.node.id !== nodeId
    const { operation } = entry
    switch (operation.op) {
      case 'connect':
        return !cancelledLinkIds.has(operation.link_id)
      case 'disconnect':
        return (
          operation.to_node !== nodeId &&
          !cancelledLinkIds.has(operation.link_id)
        )
      default:
        return true
    }
  })
}

/**
 * The document input register a live link's target slot names, resolved by
 * NAME against the bound document's own input order: the live order drifts
 * from it (an autogrow slot disconnected and regrown lands at the tail of
 * its group live, while the document keeps its order), and the applier
 * indexes the document's array. The live index stands in only while the
 * document has no such node yet. Undefined when the document has the node
 * but no slot by that name.
 */
function docInputIndex(
  docNames: readonly (string | undefined)[] | null,
  input: INodeInputSlot | undefined,
  liveIndex: number
): number | undefined {
  if (docNames === null || input === undefined) return liveIndex
  const index = docNames.indexOf(input.name)
  return index === -1 ? undefined : index
}

export function attachDocOpMinter(deps: DocOpMinterDeps): DocOpMinter {
  let pending: PendingOp[] = []
  const pendingAdds = new Map<string, LGraphNode>()
  const reported = new Set<string>()
  // Budgeted for the minter's whole life, not per flush: this one sits on the
  // keystroke-paced widget path, where a per-flush budget reports every
  // character typed into a drifted host.
  const reportedDrift = new Set<string>()
  const lastRefusalNotification = new Map<string, number>()
  let reportedBinding: string | null = null
  let flushScheduled = false
  let detached = false

  function currentBindingIdentity(): string | null {
    const workflow = deps.boundWorkflowId()
    const bound = deps.boundRootGraphId()
    if (workflow !== null && bound !== null) return `${workflow}\u0000${bound}`
    const graph = deps.getGraph()
    return workflow !== null && graph
      ? `${workflow}\u0000${toRootGraphId(graph.rootGraph.id)}`
      : null
  }

  function schedule(op: PendingOpPayload): void {
    pending.push({ ...op, binding: currentBindingIdentity() })
    if (flushScheduled) return
    flushScheduled = true
    queueMicrotask(flush)
  }

  function resetReportsForCurrentBinding(): void {
    const binding = currentBindingIdentity()
    if (binding === reportedBinding) return
    reportedBinding = binding
    reportedDrift.clear()
    lastRefusalNotification.clear()
  }

  function materializePending(
    entry: PendingOp,
    binding: string
  ): GraphOperation | null {
    if (entry.binding !== binding) return null
    if (entry.kind === 'op') return entry.operation
    const { graph, node } = entry
    if (node.graph !== graph) return null
    const snapshot = wireNodeSnapshot(node)
    if (!snapshot) {
      console.error(
        '[agent-crdt] add_node mint dropped: no snapshot for node',
        node.id
      )
      return null
    }
    return {
      op: 'add_node',
      node_id: node.id,
      class_type: snapshot.type,
      pos: [node.pos[0], node.pos[1]],
      node: snapshot
    }
  }

  function flush(): void {
    flushScheduled = false
    reported.clear()
    const batch = pending
    pending = []
    pendingAdds.clear()
    if (detached || !deps.isEnabled() || !deps.isDocBound()) return
    const binding = currentBindingIdentity()
    if (binding === null) return
    const materialized = batch.map((entry) => {
      const operation = materializePending(entry, binding)
      return { entry, operation }
    })
    const operations = withoutFailedAddDependents(materialized, binding)
    if (operations.length > 0) deps.enqueue(operations)
  }

  function reportOnce(
    key: string,
    message: string,
    errorType: string,
    context: Record<string, unknown>,
    budget: Set<string> = reported
  ): boolean {
    if (budget.has(key)) return false
    budget.add(key)
    reportError(new Error(message), { surface: 'agent', errorType, context })
    return true
  }

  /** True when `graph` is the bound document's root graph. */
  function isMintableRootScope(
    graph: LGraph,
    action: string,
    entityId: NodeId | string | number
  ): boolean {
    const activeRoot = deps.getGraph()?.rootGraph
    if (activeRoot !== graph.rootGraph) {
      reportOnce(
        `${action}:${graph.rootGraph.id}:inactive-instance`,
        `${action} targets an inactive graph instance; refusing to mint`,
        'agent_crdt_op_for_unbound_graph',
        { graphId: graph.rootGraph.id, entityId }
      )
      return false
    }
    const boundRootGraphId = deps.boundRootGraphId()
    const rootGraphId = graph.rootGraph.id
    if (boundRootGraphId !== null && rootGraphId !== boundRootGraphId) {
      reportOnce(
        `${action}:${rootGraphId}:${boundRootGraphId}`,
        `${action} targets graph ${rootGraphId}, not the bound document's root graph ${boundRootGraphId}; refusing to mint`,
        'agent_crdt_op_for_unbound_graph',
        { graphId: rootGraphId, boundRootGraphId, entityId }
      )
      return false
    }
    if (!graph.isRootGraph) {
      reportOnce(
        `${action}:${graph.id}:interior`,
        `Subgraph-interior ${action} has no wire op; the bound doc diverges from the local graph`,
        `agent_crdt_unrepresentable_subgraph_${action}`,
        { graphId: rootGraphId, ownerGraphId: graph.id, entityId }
      )
      return false
    }
    return true
  }

  function mintSetWidget(event: IntentOf<'set_widget'>): void {
    resetReportsForCurrentBinding()
    const key = nodeKey(event.graphId, event.nodeId)
    if (pendingAdds.has(key)) return
    const graph = deps.getGraph()
    if (!graph) return
    const eventGraph = reachableIntentGraph(graph, event.graphId)
    // An intent from another still-live root is local to that workflow. It is
    // neither mintable into nor rejectable against the bound document.
    if (!eventGraph) return
    const owner = findNodeInHierarchy(eventGraph, event.nodeId)
    if (!isValueWidgetWrite(owner, event)) return
    const rootGraphId = deps.boundRootGraphId() ?? graph.id
    const liveRootGraphId = graph.rootGraph.id
    if (!isMintableRootScope(graph, 'set_widget', event.nodeId)) return
    const refuse = (
      reason: WidgetRefusalReason,
      key: string,
      message: string,
      errorType: string,
      context: Record<string, unknown>,
      budget: Set<string> = reported
    ) => {
      withGraphIntentSource('agent-remote', () => {
        const store = useWidgetValueStore()
        const id = widgetId(liveRootGraphId, event.nodeId, event.name)
        if (isWidgetValue(event.previous)) store.setValue(id, event.previous)
      })
      reportOnce(key, message, errorType, context, budget)
      const now = Date.now()
      const last = lastRefusalNotification.get(key)
      if (last !== undefined && now - last < REFUSAL_NOTIFICATION_INTERVAL_MS)
        return
      lastRefusalNotification.set(key, now)
      deps.onWidgetWriteRefused?.({
        nodeId: event.nodeId,
        name: event.name,
        reason
      })
    }
    const operation = routedWidgetOperation(
      graph,
      liveRootGraphId,
      event,
      owner,
      () => {
        const doc = deps.docPromotedWidgets(event.nodeId)
        return doc
      },
      (liveNames, doc) =>
        refuse(
          'layout_drift',
          `promoted_drift:${rootGraphId}:${String(event.nodeId)}`,
          doc
            ? `Subgraph host ${String(event.nodeId)} promotes [${liveNames.join(', ')}], which the document's ${doc.valueCount} stored values and declared inputs [${doc.declaredNames.join(', ')}] do not place; refusing to mint a promoted write`
            : `Subgraph host ${String(event.nodeId)} is absent from the bound document; refusing to mint a promoted write`,
          'agent_crdt_promoted_widget_order_drift',
          {
            nodeId: event.nodeId,
            liveNames,
            docValueCount: doc?.valueCount,
            docDeclaredNames: doc?.declaredNames,
            docPromotedNames: doc?.promotedNames
          },
          reportedDrift
        ),
      (reason) =>
        refuse(
          reason,
          `widget_refused:${reason}:${rootGraphId}:${String(event.nodeId)}:${event.name}`,
          `Widget ${event.name} on node ${String(event.nodeId)} cannot be represented safely in the bound document; refusing to mint`,
          `agent_crdt_${reason}`,
          {
            nodeId: event.nodeId,
            widget: event.name,
            graphId: event.graphId
          },
          reportedDrift
        ),
      () =>
        refuse(
          'unsafe_value',
          `promoted_snapshot:${rootGraphId}:${String(event.nodeId)}:${event.name}`,
          `Widget ${event.name} on node ${String(event.nodeId)} has a value that cannot be sent safely; refusing to mint`,
          'agent_crdt_widget_snapshot_invalid',
          { nodeId: event.nodeId, widget: event.name },
          reportedDrift
        )
    )
    if (operation) schedule({ kind: 'op', operation })
  }

  function mintSetNodeField(event: IntentOf<'set_node_field'>): void {
    if (pendingAdds.has(nodeKey(event.graph.id, event.nodeId))) return
    if (!isMintableRootScope(event.graph, 'set_node_field', event.nodeId))
      return
    const {
      type: _type,
      graph: _graph,
      nodeId,
      source: _source,
      ...write
    } = event
    schedule({
      kind: 'op',
      operation: { op: 'set_node_field', node_id: nodeId, ...write }
    })
  }

  function mintRemoveNode(event: IntentOf<'remove_node'>): void {
    if (!isMintableRootScope(event.graph, 'node_delete', event.node.id)) return
    const key = nodeKey(event.graph.id, event.node.id)
    if (pendingAdds.get(key) === event.node) {
      pendingAdds.delete(key)
      pending = withoutCancelledAdd(pending, event.node.id)
      return
    }
    schedule({
      kind: 'op',
      operation: {
        op: 'delete_node',
        node_id: event.node.id,
        removed_links: [...event.removedLinkIds]
      }
    })
  }

  function reportSlotNotInDoc(
    action: 'connect' | 'disconnect',
    link: LLink,
    input: INodeInputSlot
  ): void {
    reportOnce(
      `${action}:${link.target_id}:${input.name}`,
      `${action} targets input ${input.name} of node ${String(link.target_id)}, which the bound document does not carry; the bound doc diverges from the local graph`,
      'agent_crdt_link_slot_not_in_doc',
      { action, linkId: link.id, nodeId: link.target_id, input: input.name }
    )
  }

  function mintConnect(event: IntentOf<'connect'>): void {
    if (!isMintableRootScope(event.graph, 'connect', event.link.id)) return
    const { link } = event
    const target = event.graph.getNodeById(link.target_id)
    const input = target?.inputs[link.target_slot]
    const docNames = deps.docInputNames(link.target_id)
    const toSlot = docInputIndex(docNames, input, link.target_slot)
    const connect = {
      op: 'connect',
      link_id: link.id,
      from_node: link.origin_id,
      from_slot: link.origin_slot,
      to_node: link.target_id,
      link_type: String(link.type)
    } as const
    if (toSlot !== undefined) {
      schedule({ kind: 'op', operation: { ...connect, to_slot: toSlot } })
      return
    }
    if (target && input && liveAutogrowGroupOf(target, input.name)) {
      schedule({
        kind: 'op',
        operation: {
          ...connect,
          to_slot: null,
          grow: {
            name: input.name,
            type: String(input.type),
            ...(input.widget ? { widget: input.widget.name } : {})
          }
        }
      })
      return
    }
    if (input) reportSlotNotInDoc('connect', link, input)
  }

  function mintDisconnect(event: IntentOf<'disconnect'>): void {
    if (!isMintableRootScope(event.graph, 'disconnect', event.link.id)) return
    const { link } = event
    const input = event.graph.getNodeById(link.target_id)?.inputs[
      link.target_slot
    ]
    const toSlot = docInputIndex(
      deps.docInputNames(link.target_id),
      input,
      link.target_slot
    )
    if (toSlot === undefined) {
      if (input) reportSlotNotInDoc('disconnect', link, input)
      return
    }
    schedule({
      kind: 'op',
      operation: {
        op: 'disconnect',
        link_id: link.id,
        to_node: link.target_id,
        to_slot: toSlot
      }
    })
  }

  function mintClear(event: IntentOf<'clear'>): void {
    if (event.nodeIds.length === 0) return
    if (!isMintableRootScope(event.graph, 'clear', 'all')) return
    schedule({
      kind: 'op',
      operation: { op: 'clear', removed_nodes: [...event.nodeIds] }
    })
  }

  function mintAddNode(event: IntentOf<'add_node'>): void {
    if (!isMintableRootScope(event.graph, 'node_create', event.node.id)) return
    pendingAdds.set(nodeKey(event.graph.id, event.node.id), event.node)
    schedule({ kind: 'add_node', graph: event.graph, node: event.node })
  }

  function onIntent(event: GraphIntentEvent): void {
    if (event.source !== 'local') return
    if (!deps.isEnabled() || !deps.isDocBound()) return
    mintIntent(event)
  }

  function mintIntent(event: GraphIntentEvent): void {
    switch (event.type) {
      case 'add_node':
        mintAddNode(event)
        return
      case 'remove_node':
        mintRemoveNode(event)
        return
      case 'connect':
        mintConnect(event)
        return
      case 'disconnect':
        mintDisconnect(event)
        return
      case 'clear':
        mintClear(event)
        return
      case 'set_widget':
        mintSetWidget(event)
        return
      case 'set_node_field':
        mintSetNodeField(event)
        return
    }
  }

  const detachIntents = onGraphIntent(onIntent)

  // The same gate also answers litegraph's mint-time question: a graph whose
  // edits reach the doc is a graph the agent mints into too, and must mint
  // node ids from the disjoint range (`idAllocation.ts`).
  const unregisterDocBoundProbe = registerDocBoundRootGraphProbe(() => {
    if (!deps.isEnabled() || !deps.isDocBound()) return null
    return deps.getGraph()?.rootGraph.id ?? deps.boundRootGraphId()
  })

  return {
    detach() {
      detached = true
      pending = []
      pendingAdds.clear()
      detachIntents()
      unregisterDocBoundProbe()
    }
  }
}
