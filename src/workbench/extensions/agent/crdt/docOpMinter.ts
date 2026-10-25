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
  SubgraphDefinition,
  WorkflowNode
} from '@comfyorg/comfy-multi-player'
import { isEqual } from 'es-toolkit'

import { liveAutogrowGroupOf } from '@/core/graph/widgets/dynamicWidgets'
import { registerDocBoundRootGraphProbe } from '@/lib/litegraph/src/docBoundGraphs'
import { onGraphIntent } from '@/lib/litegraph/src/graphIntents'
import type { GraphIntentEvent } from '@/lib/litegraph/src/graphIntents'
import type { INodeInputSlot } from '@/lib/litegraph/src/types/slots'
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { LLink } from '@/lib/litegraph/src/LLink'
import type { Subgraph } from '@/lib/litegraph/src/subgraph/Subgraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import { isWidgetValue } from '@/lib/litegraph/src/types/widgets'
import { reportError } from '@/platform/telemetry/reportError'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import type { DynamicComboSelection } from '@/stores/nodeDefStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { RootGraphId } from '@/types/graphScopeId'
import type { NodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import {
  findNodeInHierarchy,
  findSubgraphByUuid,
  findSubgraphNodePathById,
  traverseSubgraphPath
} from '@/utils/graphTraversalUtil'

import {
  SUBSCRIBE_ACK_MAX_TIMEOUTS,
  SUBSCRIBE_ACK_TIMEOUT_MS
} from './agentCrdtDocLifecycle'
import type { GraphOperation } from './graphOperations'
import type { DocPromotedWidgets } from './agentSubgraphDefinitions'
import { reportLostEdit } from './reportLostEdit'
import {
  isValueWidget,
  provenWidgetValuesForm,
  valueWidgetsOnly
} from './widgetValuesForm'

export interface DocOpMinterDeps {
  /** Slice 00's product gate. */
  isEnabled(): boolean
  /** A semantic doc is bound for the active workflow. */
  isDocBound(): boolean
  /** Receives minted semantic operations (the sender's inbox). */
  enqueue(operations: GraphOperation[]): void
  /** The live root graph, or null when no workflow is open. */
  getGraph(): LGraph | null
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
   * The bound document's value for a node's widget. The dynamic-combo
   * selection gate cannot tell a stale document from one that lacks the
   * widget without it, so every caller supplies it.
   */
  docWidgetValue(nodeId: NodeId, widgetName: string): unknown
  /**
   * The bound document's view of a node's promoted widget layout, or null
   * when the document holds no such node.
   */
  docPromotedWidgets(nodeId: NodeId): DocPromotedWidgets | null
  /**
   * False until the bound document has caught up, unless this tab already
   * sent the root host's `add_node` into the same document. Every resubscribe
   * (stale probe, reconnect, gap resync, ack-timeout retry) makes it false
   * again until its catch-up lands, so a false answer holds the write (see
   * {@link PROMOTED_WRITE_CATCH_UP_DEADLINE_MS}) rather than refusing it.
   */
  mayWritePromotedHost(nodeId: NodeId): boolean
  /** Whether the bound document holds a subgraph definition by this id. */
  docHasSubgraphDefinition(definitionId: string): boolean
  onWidgetWriteRefused(nodeId: NodeId, widgetName: string): void
}

/**
 * How long a promoted-host write waits for the bound document to catch up
 * before it is refused: as long as the subscribe lifecycle keeps retrying.
 */
export const PROMOTED_WRITE_CATCH_UP_DEADLINE_MS =
  SUBSCRIBE_ACK_MAX_TIMEOUTS * SUBSCRIBE_ACK_TIMEOUT_MS
/** How often a held promoted-host write rechecks the catch-up gate. */
export const PROMOTED_WRITE_RETRY_MS = 100

type PromotedWriteRefusal =
  | { reason: 'unpromoted_widget'; liveNames: readonly string[] }
  | { reason: 'doc_not_synced' }
  | { reason: 'workflow_changed' }
  | {
      reason: 'layout_drift'
      liveNames: readonly string[]
      doc: DocPromotedWidgets
    }

export interface DocOpMinter {
  detach(): void
}

type IntentOf<T extends GraphIntentEvent['type']> = Extract<
  GraphIntentEvent,
  { type: T }
>

interface HeldPromotedWrite {
  event: IntentOf<'set_widget'>
  rootGraphId: string
  heldSince: number
}

function heldWriteKey(event: IntentOf<'set_widget'>): string {
  return JSON.stringify([event.graphId, String(event.nodeId), event.name])
}

type PendingOp =
  | { kind: 'add_node'; graph: LGraph; node: LGraphNode }
  | { kind: 'op'; operation: GraphOperation }

interface DeferredDynamicConnect {
  kind: 'connect'
  operation: Omit<
    Extract<GraphOperation, { op: 'connect'; to_slot: number }>,
    'to_slot' | 'grow'
  >
}

interface DeferredDynamicDisconnect {
  kind: 'disconnect'
  operation: Omit<Extract<GraphOperation, { op: 'disconnect' }>, 'to_slot'>
}

type DeferredDynamicOperation =
  | DeferredDynamicConnect
  | DeferredDynamicDisconnect

interface PendingDynamicSlot {
  /**
   * The root graph the grow was minted against. A delayed operation may only
   * ever reach that document: CRDT-WRITE-0035 lets a batch wait, never be
   * re-addressed.
   */
  rootGraphId: string
  nodeId: NodeId
  inputName: string
  growLinkId: WireNodeId
  since: number
  sent: boolean
  deferred: DeferredDynamicOperation[]
}

interface PendingWidgetValue {
  nodeId: NodeId
  widgetName: string
  value: unknown
  documentValueAtWrite: unknown
}

type MissingSlotGrowth = NonNullable<ReturnType<typeof growForMissingSlot>>

/** Returns the node's save-format snapshot for a semantic add operation. */
export function wireNodeSnapshot(node: LGraphNode): WorkflowNode | null {
  let serialized: ISerialisedNode
  try {
    serialized = node.serialize()
  } catch {
    return null
  }
  const wireSerialized = { ...serialized }
  Reflect.deleteProperty(wireSerialized, '__incarnation')
  Reflect.deleteProperty(wireSerialized, 'widgets_values_form')
  const {
    widgets_values_named: named,
    flags: { ghost: _ghost, ...flags },
    ...rest
  } = wireSerialized
  const snapshot = { ...rest, flags } satisfies WorkflowNode
  if (!named || node.isVirtualNode) return snapshot
  const values = valueWidgetsOnly(node, named)
  // The form is proven against the POST-HOOK serialization, not derived from
  // the live widget list alone: `serialize()` above already ran the extension
  // serialize hook, which may have replaced either widget-values field.
  const form = provenWidgetValuesForm(node, values, serialized)
  return form
    ? { ...snapshot, widgets_values: values, widgets_values_form: form }
    : { ...snapshot, widgets_values: values }
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

function promotedHostWrite(
  node: LGraphNode,
  event: IntentOf<'set_widget'>,
  deps: Pick<DocOpMinterDeps, 'docPromotedWidgets' | 'mayWritePromotedHost'>
): PromotedHostWrite | PromotedWriteRefusal {
  const hostInputs = node.inputs.flatMap((input) =>
    input.widgetId ? [{ name: input.name, widgetId: input.widgetId }] : []
  )
  const valueIndex = hostInputs.findIndex((input) => input.name === event.name)
  const liveNames = hostInputs.map((input) => input.name)
  if (valueIndex === -1) return { reason: 'unpromoted_widget', liveNames }
  if (!deps.mayWritePromotedHost(event.nodeId))
    return { reason: 'doc_not_synced' }
  const doc = deps.docPromotedWidgets(event.nodeId)
  if (doc !== null && !documentAcceptsLiveIndex(doc, liveNames))
    return { reason: 'layout_drift', liveNames, doc }
  const widgetValueStore = useWidgetValueStore()
  return {
    value_index: valueIndex,
    instance_path: [String(event.nodeId)],
    host_widgets_values: hostInputs.map((input, index) => {
      if (index === valueIndex) return event.value
      const value = widgetValueStore.getWidget(input.widgetId)?.value
      return isWidgetValue(value) ? value : undefined
    })
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
  if (doc === null) return true
  const namesMatch =
    doc.promotedNames != null &&
    doc.promotedNames.length === liveNames.length &&
    doc.promotedNames.every((name, index) => name === liveNames[index])
  if (doc.valueCount === 0) return doc.promotedNames === undefined || namesMatch
  return doc.valueCount === liveNames.length && namesMatch
}

function routedWidgetOperation(
  graph: LGraph,
  rootGraphId: string,
  event: IntentOf<'set_widget'>,
  node: LGraphNode | null,
  deps: Pick<DocOpMinterDeps, 'docPromotedWidgets' | 'mayWritePromotedHost'>
): GraphOperation | PromotedWriteRefusal | { unresolvedGraphId: string } {
  const operation = {
    op: 'set_widget',
    node_id: event.nodeId,
    widget: event.name,
    value: event.value,
    old: event.previous
  } as const
  const owningGraphId = node?.graph?.id ?? event.graphId
  if (owningGraphId === rootGraphId) {
    if (!node?.isSubgraphNode()) return operation
    const promoted = promotedHostWrite(node, event, deps)
    return 'reason' in promoted ? promoted : { ...operation, promoted }
  }
  const subgraphNodePath = findSubgraphNodePathById(graph, owningGraphId)
  if (subgraphNodePath === null || subgraphNodePath.length === 0)
    return { unresolvedGraphId: owningGraphId }
  const [head, ...rest] = subgraphNodePath
  return {
    ...operation,
    path: [head, ...rest, String(event.nodeId)],
    inner_widget: event.name
  }
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
export function docInputIndex(
  docNames: readonly (string | undefined)[] | null,
  input: Pick<INodeInputSlot, 'name'> | undefined,
  liveIndex: number
): number | undefined {
  if (docNames === null || input === undefined) return liveIndex
  const index = docNames.indexOf(input.name)
  return index === -1 ? undefined : index
}

function growForMissingSlot(
  target: LGraphNode | null | undefined,
  input: INodeInputSlot | undefined
):
  | {
      grow: { name: string; type: string; widget?: string }
      selection?: DynamicComboSelection
    }
  | undefined {
  if (!target || !input) return undefined
  const widgetBacked = !!input.widget && !target.isSubgraphNode()
  const autogrow = !!liveAutogrowGroupOf(target, input.name)
  const selection = useNodeDefStore().getDynamicComboSelectionForInput(
    target,
    input.name
  )
  if (!widgetBacked && !autogrow && !selection) return undefined
  return {
    grow: {
      name: input.name,
      type: String(input.type),
      ...(input.widget ? { widget: input.widget.name } : {})
    },
    ...(selection ? { selection } : {})
  }
}

function canvasReplaced(graph: LGraph, event: IntentOf<'set_widget'>): boolean {
  const eventGraph = reachableIntentGraph(graph, event.graphId)
  const host = eventGraph ? findNodeInHierarchy(eventGraph, event.nodeId) : null
  const input = host?.inputs.find((slot) => slot.name === event.name)
  const stored = input?.widgetId
    ? useWidgetValueStore().getWidget(input.widgetId)
    : undefined
  return stored !== undefined && !isEqual(stored.value, event.value)
}

export function attachDocOpMinter(deps: DocOpMinterDeps): DocOpMinter {
  let pending: PendingOp[] = []
  const pendingAdds = new Map<string, LGraphNode>()
  const pendingDynamicSlots = new Map<string, PendingDynamicSlot>()
  const pendingWidgetValues = new Map<string, PendingWidgetValue>()
  const reported = new Set<string>()
  const reportedRefusals = new Set<string>()
  const heldPromotedWrites = new Map<string, HeldPromotedWrite>()
  let heldRetryTimer: ReturnType<typeof setTimeout> | null = null
  let dynamicSlotRetryTimer: ReturnType<typeof setTimeout> | null = null
  let flushScheduled = false
  let detached = false

  /**
   * Scopes a pending slot to the document it was grown in, so a delayed
   * operation can never be found — and replayed — under another one.
   */
  function dynamicSlotKey(
    rootGraphId: string,
    nodeId: NodeId,
    inputName: string
  ): string {
    return JSON.stringify([rootGraphId, String(nodeId), inputName])
  }

  function widgetValueKey(nodeId: NodeId, widgetName: string): string {
    return JSON.stringify([String(nodeId), widgetName])
  }

  /**
   * True while the document still reads what it read when the write was
   * minted, which is the only state in which that write can still be the
   * next one to land. A document that reflects the written value has settled
   * it; any other value superseded it.
   */
  function widgetWriteInFlight(pending: PendingWidgetValue): boolean {
    const documentValue = deps.docWidgetValue(
      pending.nodeId,
      pending.widgetName
    )
    return (
      isEqual(documentValue, pending.documentValueAtWrite) &&
      !isEqual(documentValue, pending.value)
    )
  }

  /** Drops recorded writes the document has settled or superseded. */
  function retireSettledWidgetValues(): void {
    for (const [key, pending] of pendingWidgetValues)
      if (!widgetWriteInFlight(pending)) pendingWidgetValues.delete(key)
  }

  /**
   * Whether the bound document will carry this selector value by the time the
   * grow lands. An in-flight selector write decides it, because that write is
   * what the document reads next; otherwise the document's own value does.
   */
  function documentMatchesSelection(
    nodeId: NodeId,
    selection: DynamicComboSelection
  ): boolean {
    const key = widgetValueKey(nodeId, selection.widget)
    const pending = pendingWidgetValues.get(key)
    if (pending && !widgetWriteInFlight(pending))
      pendingWidgetValues.delete(key)
    const inFlight = pendingWidgetValues.get(key)
    if (inFlight) return isEqual(inFlight.value, selection.value)
    return isEqual(
      deps.docWidgetValue(nodeId, selection.widget),
      selection.value
    )
  }

  function resolvedDynamicSlot(state: PendingDynamicSlot): number | undefined {
    const names = deps.docInputNames(state.nodeId)
    const index = names?.indexOf(state.inputName) ?? -1
    return index < 0 ? undefined : index
  }

  function scheduleDeferredDynamicOperation(
    deferred: DeferredDynamicOperation,
    toSlot: number
  ): void {
    schedule({
      kind: 'op',
      operation: { ...deferred.operation, to_slot: toSlot }
    })
  }

  function releaseDynamicSlot(state: PendingDynamicSlot): boolean {
    const toSlot = resolvedDynamicSlot(state)
    if (toSlot === undefined) return false
    pendingDynamicSlots.delete(pendingSlotKey(state))
    for (const deferred of state.deferred)
      scheduleDeferredDynamicOperation(deferred, toSlot)
    return true
  }

  function pendingSlotKey(state: PendingDynamicSlot): string {
    return dynamicSlotKey(state.rootGraphId, state.nodeId, state.inputName)
  }

  /**
   * Drops a pending slot whose document is no longer bound, so its deferred
   * operations are never re-addressed to the document that replaced it.
   */
  function dropRetargetedDynamicSlot(state: PendingDynamicSlot): boolean {
    const boundRootGraphId =
      deps.boundRootGraphId() ?? deps.getGraph()?.rootGraph.id ?? null
    if (boundRootGraphId === null || boundRootGraphId === state.rootGraphId)
      return false
    const key = pendingSlotKey(state)
    pendingDynamicSlots.delete(key)
    reportOnce(
      `dynamic_slot_workflow_changed:${key}`,
      `Dynamic-combo input ${state.inputName} of node ${String(state.nodeId)} belongs to graph ${state.rootGraphId}, which is no longer bound; dropping its deferred link operations rather than replaying them into ${boundRootGraphId}`,
      'agent_crdt_link_slot_workflow_changed',
      {
        nodeId: state.nodeId,
        input: state.inputName,
        rootGraphId: state.rootGraphId,
        boundRootGraphId,
        operations: state.deferred.map(({ kind }) => kind)
      }
    )
    return true
  }

  function dropExpiredDynamicSlot(state: PendingDynamicSlot): boolean {
    if (performance.now() - state.since < PROMOTED_WRITE_CATCH_UP_DEADLINE_MS)
      return false
    const key = pendingSlotKey(state)
    pendingDynamicSlots.delete(key)
    reportOnce(
      `dynamic_slot_timeout:${key}`,
      `Dynamic-combo input ${state.inputName} of node ${String(state.nodeId)} never reached the bound document; dropping its deferred link operations`,
      'agent_crdt_link_slot_not_in_doc',
      {
        nodeId: state.nodeId,
        input: state.inputName,
        operations: state.deferred.map(({ kind }) => kind)
      }
    )
    return true
  }

  function retryDynamicSlots(): void {
    dynamicSlotRetryTimer = null
    if (detached) return
    let waiting = false
    for (const state of pendingDynamicSlots.values()) {
      if (dropRetargetedDynamicSlot(state)) continue
      if (releaseDynamicSlot(state) || dropExpiredDynamicSlot(state)) continue
      waiting = true
    }
    if (waiting)
      dynamicSlotRetryTimer = setTimeout(
        retryDynamicSlots,
        PROMOTED_WRITE_RETRY_MS
      )
  }

  function retryDynamicSlotsSoon(): void {
    if (dynamicSlotRetryTimer !== null) return
    dynamicSlotRetryTimer = setTimeout(
      retryDynamicSlots,
      PROMOTED_WRITE_RETRY_MS
    )
  }

  function schedule(op: PendingOp): void {
    pending.push(op)
    if (flushScheduled) return
    flushScheduled = true
    queueMicrotask(flush)
  }

  function mintAddNodeOperation(
    graph: LGraph,
    node: LGraphNode
  ): GraphOperation | null {
    if (node.graph !== graph) return null
    const snapshot = wireNodeSnapshot(node)
    if (!snapshot) {
      const key = `snapshot:${nodeKey(graph.id, node.id)}`
      if (reported.has(key)) return null
      reported.add(key)
      reportLostEdit('mint_divergence', [{ op: 'add_node' }], {
        code: 'missing_node_snapshot',
        errorType: 'agent_crdt_node_snapshot_missing',
        graphId: graph.id,
        nodeId: node.id
      })
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

  function serialisedDefinition(subgraph: Subgraph): SubgraphDefinition | null {
    try {
      return JSON.parse(JSON.stringify(subgraph.asSerialisable()))
    } catch (error) {
      reportError(error, {
        surface: 'agent',
        errorType: 'agent_crdt_subgraph_definition_unserializable',
        context: { definitionId: subgraph.id }
      })
      return null
    }
  }

  function mintMissingDefinitions(
    hosts: readonly SubgraphNode[]
  ): GraphOperation[] {
    const operations: GraphOperation[] = []
    const available = new Map<string, boolean>()
    const define = (subgraph: Subgraph): boolean => {
      const settled = available.get(subgraph.id)
      if (settled !== undefined) return settled
      available.set(subgraph.id, false)
      const dependenciesAvailable = subgraph.nodes
        .filter((node) => node.isSubgraphNode())
        .map((node) => define(node.subgraph))
        .every(Boolean)
      if (deps.docHasSubgraphDefinition(subgraph.id)) {
        available.set(subgraph.id, true)
        return true
      }
      const definition = dependenciesAvailable
        ? serialisedDefinition(subgraph)
        : null
      if (!definition) return false
      operations.push({
        op: 'define_subgraph',
        subgraph_id: subgraph.id,
        subgraph_definition: definition
      })
      available.set(subgraph.id, true)
      return true
    }
    for (const host of hosts) define(host.subgraph)
    return operations
  }

  function flush(): void {
    flushScheduled = false
    reported.clear()
    const batch = pending
    pending = []
    pendingAdds.clear()
    if (detached) return
    const hosts: SubgraphNode[] = []
    const operations = batch.flatMap((entry) => {
      if (entry.kind === 'op') return [entry.operation]
      const operation = mintAddNodeOperation(entry.graph, entry.node)
      if (!operation) return []
      if (entry.node.isSubgraphNode()) hosts.push(entry.node)
      return [operation]
    })
    operations.push(...mintMissingDefinitions(hosts))
    for (const state of pendingDynamicSlots.values()) {
      if (state.sent) continue
      state.sent = operations.some(
        (operation) =>
          operation.op === 'connect' &&
          operation.link_id === state.growLinkId &&
          'grow' in operation
      )
    }
    if (operations.length > 0) deps.enqueue(operations)
  }

  function reportOnce(
    key: string,
    message: string,
    errorType: string,
    context: Record<string, unknown>,
    budget: Set<string> = reported
  ): void {
    if (budget.has(key)) return
    budget.add(key)
    reportError(new Error(message), { surface: 'agent', errorType, context })
  }

  /** True when `graph` is the bound document's root graph. */
  function isMintableRootScope(
    graph: LGraph,
    action: string,
    entityId: NodeId | string | number
  ): boolean {
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

  function routeSetWidget(
    event: IntentOf<'set_widget'>,
    retried: HeldPromotedWrite | null
  ): void {
    const held = retried ?? takeHeldWrite(event)
    if (pendingAdds.has(nodeKey(event.graphId, event.nodeId))) return
    const graph = deps.getGraph()
    if (!graph) return
    const eventGraph = reachableIntentGraph(graph, event.graphId)
    const owner = eventGraph
      ? findNodeInHierarchy(eventGraph, event.nodeId)
      : null
    if (!isValueWidgetWrite(owner, event)) return
    const rootGraphId = deps.boundRootGraphId() ?? graph.id
    const routed = routedWidgetOperation(graph, rootGraphId, event, owner, deps)
    if ('unresolvedGraphId' in routed) {
      reportUnresolvedWidgetOwner(routed.unresolvedGraphId, event)
      return
    }
    if ('reason' in routed) {
      holdOrRefuseWidgetWrite(rootGraphId, event, routed, held)
      return
    }
    rememberPendingWidgetValue(routed, event)
    schedule({ kind: 'op', operation: routed })
  }

  function rememberPendingWidgetValue(
    operation: GraphOperation,
    event: IntentOf<'set_widget'>
  ): void {
    if (
      operation.op !== 'set_widget' ||
      'path' in operation ||
      'promoted' in operation
    )
      return
    retireSettledWidgetValues()
    pendingWidgetValues.set(widgetValueKey(event.nodeId, event.name), {
      nodeId: event.nodeId,
      widgetName: event.name,
      value: event.value,
      documentValueAtWrite: deps.docWidgetValue(event.nodeId, event.name)
    })
  }

  function reportUnresolvedWidgetOwner(
    graphId: string,
    event: IntentOf<'set_widget'>
  ): void {
    const key = `owner:${nodeKey(graphId, event.nodeId)}`
    if (reportedRefusals.has(key)) return
    reportedRefusals.add(key)
    reportLostEdit('mint_divergence', [{ op: 'set_widget' }], {
      code: 'unresolvable_widget_owner',
      errorType: 'agent_crdt_widget_owner_unresolved',
      graphId,
      nodeId: event.nodeId
    })
  }

  function takeHeldWrite(
    event: IntentOf<'set_widget'>
  ): HeldPromotedWrite | null {
    const key = heldWriteKey(event)
    const held = heldPromotedWrites.get(key) ?? null
    heldPromotedWrites.delete(key)
    return held
  }

  function holdOrRefuseWidgetWrite(
    rootGraphId: string,
    event: IntentOf<'set_widget'>,
    refusal: PromotedWriteRefusal,
    held: HeldPromotedWrite | null
  ): void {
    const heldSince = held?.heldSince ?? performance.now()
    const mayWait =
      refusal.reason === 'doc_not_synced' &&
      performance.now() - heldSince < PROMOTED_WRITE_CATCH_UP_DEADLINE_MS
    if (mayWait) holdPromotedWrite({ event, rootGraphId, heldSince })
    else refuseWidgetWrite(rootGraphId, event, refusal)
  }

  function refuseWidgetWrite(
    rootGraphId: string,
    event: IntentOf<'set_widget'>,
    refusal: PromotedWriteRefusal
  ): void {
    reportRefusal(rootGraphId, event, refusal)
    deps.onWidgetWriteRefused(event.nodeId, event.name)
  }

  function holdPromotedWrite(held: HeldPromotedWrite): void {
    heldPromotedWrites.set(heldWriteKey(held.event), held)
    if (heldRetryTimer !== null) return
    heldRetryTimer = setTimeout(
      retryHeldPromotedWrites,
      PROMOTED_WRITE_RETRY_MS
    )
  }

  function retryHeldPromotedWrites(): void {
    heldRetryTimer = null
    if (detached) return
    const held = [...heldPromotedWrites.values()]
    heldPromotedWrites.clear()
    const bound = deps.isDocBound()
    if (!deps.isEnabled() || (!bound && deps.boundRootGraphId() === null))
      return
    const graph = bound ? deps.getGraph() : null
    for (const entry of held) {
      if (graph) retryHeldWrite(graph, entry)
      else waitOrGiveUp(entry)
    }
  }

  function waitOrGiveUp(entry: HeldPromotedWrite): void {
    if (!heldTooLong(entry)) holdPromotedWrite(entry)
    else
      refuseWidgetWrite(entry.rootGraphId, entry.event, {
        reason: 'doc_not_synced'
      })
  }

  function heldTooLong(entry: HeldPromotedWrite): boolean {
    return (
      performance.now() - entry.heldSince >= PROMOTED_WRITE_CATCH_UP_DEADLINE_MS
    )
  }

  function retryHeldWrite(graph: LGraph, entry: HeldPromotedWrite): void {
    if (canvasReplaced(graph, entry.event)) return
    if ((deps.boundRootGraphId() ?? graph.id) !== entry.rootGraphId) {
      refuseWidgetWrite(entry.rootGraphId, entry.event, {
        reason: 'workflow_changed'
      })
      return
    }
    routeSetWidget(entry.event, entry)
  }

  function reportRefusal(
    rootGraphId: string,
    event: IntentOf<'set_widget'>,
    refusal: PromotedWriteRefusal
  ): void {
    const host = String(event.nodeId)
    switch (refusal.reason) {
      case 'layout_drift': {
        const { liveNames, doc } = refusal
        reportOnce(
          `promoted_drift:${rootGraphId}:${host}`,
          `Subgraph host ${host} promotes [${liveNames.join(', ')}], which the document's ${doc.valueCount} stored values and declared inputs [${doc.declaredNames.join(', ')}] do not place; refusing to mint a promoted write`,
          'agent_crdt_promoted_widget_order_drift',
          {
            nodeId: event.nodeId,
            liveNames,
            docValueCount: doc.valueCount,
            docDeclaredNames: doc.declaredNames,
            docPromotedNames: doc.promotedNames
          },
          reportedRefusals
        )
        return
      }
      case 'unpromoted_widget':
        reportOnce(
          `promoted_unpromoted:${rootGraphId}:${host}:${event.name}`,
          `Widget ${event.name} on subgraph host ${host} is not one of its promoted inputs [${refusal.liveNames.join(', ')}]; refusing to mint`,
          'agent_crdt_promoted_widget_not_promoted',
          {
            nodeId: event.nodeId,
            widget: event.name,
            liveNames: refusal.liveNames
          },
          reportedRefusals
        )
        return
      case 'workflow_changed':
        reportOnce(
          `promoted_workflow_changed:${rootGraphId}:${host}`,
          `Subgraph host ${host} was edited while the bound document caught up, and the bound workflow changed before it did; refusing to mint a promoted write`,
          'agent_crdt_promoted_widget_workflow_changed',
          { nodeId: event.nodeId, widget: event.name },
          reportedRefusals
        )
        return
      case 'doc_not_synced':
        reportOnce(
          `promoted_unsynced:${rootGraphId}:${host}`,
          `Subgraph host ${host} was edited before the bound document caught up; refusing to mint a promoted write`,
          'agent_crdt_promoted_widget_doc_not_synced',
          { nodeId: event.nodeId, widget: event.name },
          reportedRefusals
        )
        return
      default: {
        const unhandled: never = refusal
        return unhandled
      }
    }
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
    for (const [key, state] of pendingDynamicSlots)
      if (state.nodeId === event.node.id) pendingDynamicSlots.delete(key)
    for (const [key, pending] of pendingWidgetValues)
      if (pending.nodeId === event.node.id) pendingWidgetValues.delete(key)
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

  function mintMissingSlotConnect(
    rootGraphId: string,
    link: LLink,
    target: LGraphNode | null | undefined,
    input: INodeInputSlot | undefined,
    slotKey: string | undefined,
    pendingSlot: PendingDynamicSlot | undefined,
    connect: DeferredDynamicConnect['operation']
  ): void {
    const growth = growForMissingSlot(target, input)
    if (growth?.selection) {
      if (!documentMatchesSelection(link.target_id, growth.selection)) {
        if (input) reportSlotNotInDoc('connect', link, input)
        return
      }
      if (pendingSlot) {
        pendingSlot.deferred.push({ kind: 'connect', operation: connect })
        retryDynamicSlotsSoon()
        return
      }
    }
    if (!growth) {
      if (input) reportSlotNotInDoc('connect', link, input)
      return
    }
    scheduleGrowthConnect(rootGraphId, link, input, slotKey, connect, growth)
  }

  function scheduleGrowthConnect(
    rootGraphId: string,
    link: LLink,
    input: INodeInputSlot | undefined,
    slotKey: string | undefined,
    connect: DeferredDynamicConnect['operation'],
    growth: MissingSlotGrowth
  ): void {
    schedule({
      kind: 'op',
      operation: { ...connect, to_slot: null, grow: growth.grow }
    })
    if (!growth.selection || !input || !slotKey) return
    pendingDynamicSlots.set(slotKey, {
      rootGraphId,
      nodeId: link.target_id,
      inputName: input.name,
      growLinkId: link.id,
      since: performance.now(),
      sent: false,
      deferred: []
    })
    retryDynamicSlotsSoon()
  }

  function mintConnect(event: IntentOf<'connect'>): void {
    if (!isMintableRootScope(event.graph, 'connect', event.link.id)) return
    const { link } = event
    const target = event.graph.getNodeById(link.target_id)
    const input = target?.inputs[link.target_slot]
    const docNames = deps.docInputNames(link.target_id)
    const toSlot = docInputIndex(docNames, input, link.target_slot)
    const rootGraphId = event.graph.rootGraph.id
    const slotKey = input
      ? dynamicSlotKey(rootGraphId, link.target_id, input.name)
      : undefined
    const pendingSlot = slotKey ? pendingDynamicSlots.get(slotKey) : undefined
    if (pendingSlot && toSlot !== undefined) releaseDynamicSlot(pendingSlot)
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
    mintMissingSlotConnect(
      rootGraphId,
      link,
      target,
      input,
      slotKey,
      pendingSlot,
      connect
    )
  }

  function mintMissingSlotDisconnect(
    link: LLink,
    input: INodeInputSlot | undefined,
    slotKey: string | undefined,
    pendingSlot: PendingDynamicSlot | undefined
  ): void {
    if (!pendingSlot) {
      if (input) reportSlotNotInDoc('disconnect', link, input)
      return
    }
    if (!pendingSlot.sent && pendingSlot.growLinkId === link.id) {
      pending = pending.filter(
        (entry) =>
          entry.kind !== 'op' ||
          entry.operation.op !== 'connect' ||
          entry.operation.link_id !== link.id ||
          !('grow' in entry.operation)
      )
      if (slotKey) pendingDynamicSlots.delete(slotKey)
      return
    }
    pendingSlot.deferred.push({
      kind: 'disconnect',
      operation: {
        op: 'disconnect',
        link_id: link.id,
        to_node: link.target_id
      }
    })
    retryDynamicSlotsSoon()
  }

  function mintDisconnect(event: IntentOf<'disconnect'>): void {
    if (!isMintableRootScope(event.graph, 'disconnect', event.link.id)) return
    const { link } = event
    const input = event.graph.getNodeById(link.target_id)?.inputs[
      link.target_slot
    ]
    const slotKey = input
      ? dynamicSlotKey(event.graph.rootGraph.id, link.target_id, input.name)
      : undefined
    const pendingSlot = slotKey ? pendingDynamicSlots.get(slotKey) : undefined
    const toSlot = docInputIndex(
      deps.docInputNames(link.target_id),
      input,
      link.target_slot
    )
    if (toSlot === undefined) {
      mintMissingSlotDisconnect(link, input, slotKey, pendingSlot)
      return
    }
    if (pendingSlot) releaseDynamicSlot(pendingSlot)
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
    const boundRootGraphId = deps.boundRootGraphId()
    if (boundRootGraphId !== null && event.graphId !== boundRootGraphId) {
      reportOnce(
        `clear:${event.graphId}:${boundRootGraphId}`,
        `clear targets graph ${event.graphId}, not the bound document's root graph ${boundRootGraphId}; refusing to mint`,
        'agent_crdt_op_for_unbound_graph',
        { graphId: event.graphId, boundRootGraphId }
      )
      return
    }
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
    if (!deps.isEnabled() || !deps.isDocBound()) {
      if (event.type === 'set_widget')
        heldPromotedWrites.delete(heldWriteKey(event))
      return
    }
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
        routeSetWidget(event, null)
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
    const graph = deps.getGraph()
    if (!graph) return null
    return graph.rootGraph.id
  })

  return {
    detach() {
      detached = true
      pending = []
      pendingAdds.clear()
      pendingDynamicSlots.clear()
      pendingWidgetValues.clear()
      heldPromotedWrites.clear()
      if (heldRetryTimer !== null) clearTimeout(heldRetryTimer)
      heldRetryTimer = null
      if (dynamicSlotRetryTimer !== null) clearTimeout(dynamicSlotRetryTimer)
      dynamicSlotRetryTimer = null
      detachIntents()
      unregisterDocBoundProbe()
    }
  }
}
