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

import {
  documentInputIndex,
  documentInputSlot
} from '@/core/graph/widgets/documentSlots'
import { registerDocBoundRootGraphProbe } from '@/lib/litegraph/src/docBoundGraphs'
import { onGraphIntent } from '@/lib/litegraph/src/graphIntents'
import type {
  GraphIntentEvent,
  NodeFieldWrite
} from '@/lib/litegraph/src/graphIntents'
import type { INodeInputSlot } from '@comfyorg/graph-model/slots'
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { LLink } from '@/lib/litegraph/src/LLink'
import type { Subgraph } from '@/lib/litegraph/src/subgraph/Subgraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { ISerialisedNode } from '@comfyorg/graph-model/serialisation'
import { isWidgetValue } from '@comfyorg/graph-model/widgets'
import { reportError } from '@comfyorg/telemetry/reportError'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { onGraphRestored } from '@/scripts/graphRestore'
import type { GraphRestore } from '@/scripts/graphRestore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import type { DynamicComboSelection } from '@/stores/nodeDefStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { RootGraphId } from '@comfyorg/graph-model/graphScopeId'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import { widgetId } from '@comfyorg/graph-model/widgetId'
import {
  findNodeInHierarchy,
  findSubgraphByUuid,
  findSubgraphNodePathById,
  traverseSubgraphPath
} from '@/utils/graphTraversalUtil'

import { SUBSCRIBE_ACK_MAX_TIMEOUTS } from './agentCrdtDocLifecycle'
import type { GraphOperation } from './graphOperations'
import type { DocPromotedWidgets } from './agentSubgraphDefinitions'
import { SUBSCRIBE_ACK_TIMEOUT_MS } from './lifecycleTiming'
import { promotedHostInputs } from './promotedHostInputs'
import { reportLostEdit } from './reportLostEdit'
import {
  isReplicatedValueWidget,
  provenWidgetValuesForm,
  replicatedWidgetValues
} from './widgetValuesForm'

export interface DocOpMinterDeps {
  /** Slice 00's product gate. */
  isEnabled(): boolean
  /** A semantic doc is bound for the active workflow. */
  isDocBound(): boolean
  /** Records a local edit that cannot yet enter the semantic document. */
  onUnboundLocalIntent?(): void
  /** Records a local edit to the visible workflow while another one, or none, is bound. */
  onUnboundVisibleIntent?(rootGraph: LGraph): void
  /** Whether `workflow` is the one whose document the panel is bound to. */
  isBoundWorkflow(workflow: ComfyWorkflow): boolean
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
  /**
   * True while the bound workflow has no document yet (subscribe acknowledged
   * at seq 0, nothing integrated). A promoted write still held at the
   * deadline then stays on the canvas instead of being refused: the turn-start
   * mint seeds from the canvas, so the edit is not lost.
   */
  isPreMintBinding?(): boolean
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
  | {
      reason: 'layout_changed'
      mintedNames: readonly string[]
      liveNames: readonly string[]
    }

export interface DocOpMinter {
  /** Sends held undo/redo restore operations once the document can receive them; drops them if the binding moved. */
  deliverHeldRestores(): void
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

interface LinkTarget {
  nodeId: NodeId
  node: LGraphNode | undefined
  input: INodeInputSlot | undefined
  liveSlot: number
}

type DisconnectTarget = Omit<LinkTarget, 'input'> & {
  input: Pick<INodeInputSlot, 'name'> | undefined
}

type PendingLinkOp =
  | {
      kind: 'connect'
      operation: Omit<
        Extract<GraphOperation, { op: 'connect' }>,
        'to_slot' | 'grow'
      >
      target: LinkTarget
    }
  | {
      kind: 'disconnect'
      operation: Omit<Extract<GraphOperation, { op: 'disconnect' }>, 'to_slot'>
      target: DisconnectTarget
    }

type PendingOp =
  | { kind: 'add_node'; graph: LGraph; node: LGraphNode }
  | { kind: 'op'; operation: GraphOperation }
  | PendingPromotedWrite
  | PendingLinkOp

type PromotedSetWidget = Extract<GraphOperation, { op: 'set_widget' }> & {
  promoted: PromotedHostWrite
}

function isPromotedSetWidget(
  operation: GraphOperation
): operation is PromotedSetWidget {
  return operation.op === 'set_widget' && 'promoted' in operation
}

interface PendingPromotedWrite {
  kind: 'promoted_write'
  operation: PromotedSetWidget
  host: LGraphNode
  mintedNames: readonly string[]
  rootGraphId: string
  event: IntentOf<'set_widget'>
}

interface PendingGrownSlot {
  rootGraphId: string
  nodeId: NodeId
  inputName: string
  growLinkId: WireNodeId
  since: number
  sent: boolean
  deferred: PendingLinkOp[]
}

interface PendingWidgetValue {
  nodeId: NodeId
  widgetName: string
  value: unknown
  documentValueAtWrite: unknown
}

/**
 * Returns the node's save-format snapshot for a semantic add operation.
 *
 * Excludes only subgraph hosts, whose widget values are positional by design
 * (`applyHostWidgets` indexes them against the live promoted inputs). Every
 * other named-value node gets a declared `widgets_values_form` when one can
 * be proven (schema A24); otherwise it keeps the positional snapshot rather
 * than shipping an undeclared name-keyed record (KA-12).
 */
export function wireNodeSnapshot(
  node: LGraphNode,
  onPositionalDropped?: (counts: { positional: number; named: number }) => void
): WorkflowNode | null {
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
  if (!named || node.isSubgraphNode()) return snapshot
  const values = replicatedWidgetValues(node, named)
  const form = provenWidgetValuesForm(node, values, serialized)
  if (!form && node.isVirtualNode) return snapshot
  const positional = serialized.widgets_values
  const namedCount = Object.keys(named).length
  if (Array.isArray(positional) && positional.length > namedCount)
    onPositionalDropped?.({ positional: positional.length, named: namedCount })
  return form
    ? { ...snapshot, widgets_values: values, widgets_values_form: form }
    : { ...snapshot, widgets_values: values }
}

function nodeKey(graphId: string, nodeId: NodeId): string {
  return `${graphId}:${String(nodeId)}`
}

function slotDivergenceShape(
  node: LGraphNode | undefined,
  input: Pick<INodeInputSlot, 'name'>,
  docInputNames: readonly (string | undefined)[] | null
): Record<string, unknown> {
  const store = useNodeDefStore()
  const definition = node ? store.fromLGraphNode(node) : null
  return {
    classType: node?.type,
    declared:
      node && definition
        ? store.getInputSpecForWidget(node, input.name) !== undefined
        : null,
    liveInputs: node?.inputs.map((slot) => slot.name) ?? null,
    docInputs: docInputNames ? [...docInputNames] : null
  }
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
  return isReplicatedValueWidget(widget, stored)
}

function promotedHostWrite(
  node: LGraphNode,
  event: IntentOf<'set_widget'>,
  deps: Pick<DocOpMinterDeps, 'docPromotedWidgets' | 'mayWritePromotedHost'>
): PromotedHostWrite | PromotedWriteRefusal {
  const hostInputs = promotedHostInputs(node)
  const valueIndex = hostInputs.findIndex(
    ({ input }) => input.name === event.name
  )
  const liveNames = hostInputs.map(({ input }) => input.name)
  if (valueIndex === -1) return { reason: 'unpromoted_widget', liveNames }
  if (!deps.mayWritePromotedHost(event.nodeId))
    return { reason: 'doc_not_synced' }
  const doc = deps.docPromotedWidgets(event.nodeId)
  if (doc !== null && !documentAcceptsLiveIndex(doc, liveNames))
    return { reason: 'layout_drift', liveNames, doc }
  return promotedHostPayload(node, event.nodeId, valueIndex)
}

function promotedHostPayload(
  node: LGraphNode,
  nodeId: NodeId,
  valueIndex: number
): PromotedHostWrite {
  return {
    value_index: valueIndex,
    instance_path: [String(nodeId)],
    host_widgets_values: promotedHostInputs(node).map((input, index) => {
      if (index === valueIndex) return undefined
      const value = input.readValue()
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
    value: event.value
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

function withoutCancelledAdd<Op extends PendingOp>(
  pending: Op[],
  nodeId: NodeId
): Op[] {
  const cancelledLinkIds = new Set<WireNodeId>()
  for (const entry of pending) {
    if (entry.kind !== 'connect') continue
    const { from_node, to_node, link_id } = entry.operation
    if (from_node === nodeId || to_node === nodeId)
      cancelledLinkIds.add(link_id)
  }
  return pending.filter((entry) => {
    switch (entry.kind) {
      case 'add_node':
        return entry.node.id !== nodeId
      case 'connect':
        return !cancelledLinkIds.has(entry.operation.link_id)
      case 'disconnect':
        return (
          entry.operation.to_node !== nodeId &&
          !cancelledLinkIds.has(entry.operation.link_id)
        )
      case 'op':
      case 'promoted_write':
        return true
    }
  })
}

function isQueuedConnect(entry: PendingOp, linkId: WireNodeId): boolean {
  return entry.kind === 'connect' && entry.operation.link_id === linkId
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

type RestoredGraph = GraphRestore['previous']
type RestoredScope = Pick<RestoredGraph, 'nodes' | 'links'>
type SerializedNode = RestoredGraph['nodes'][number]

interface SerializedLink {
  id: number
  origin_id: string
  target_id: string
  target_slot: number
}

interface SerializedGraph {
  nodes: ReadonlyMap<string, SerializedNode>
  links: ReadonlyMap<number, SerializedLink>
}

function serializedGraph(state: RestoredScope): SerializedGraph {
  const links = (state.links ?? []).map((link): SerializedLink => {
    const [id, originId, targetId, targetSlot] = Array.isArray(link)
      ? [link[0], link[1], link[3], link[4]]
      : [link.id, link.origin_id, link.target_id, link.target_slot]
    return {
      id,
      origin_id: String(originId),
      target_id: String(targetId),
      target_slot: targetSlot
    }
  })
  return {
    nodes: new Map(state.nodes.map((node) => [String(node.id), node])),
    links: new Map(links.map((link) => [link.id, link]))
  }
}

function subgraphInteriors(state: RestoredGraph): Map<string, RestoredScope> {
  return new Map(
    (state.definitions?.subgraphs ?? []).flatMap(
      (definition): [string, RestoredScope][] =>
        hasRestoredScope(definition) ? [[definition.id, definition]] : []
    )
  )
}

function hasRestoredScope<T extends object>(
  definition: T
): definition is T & RestoredScope {
  return 'nodes' in definition && Array.isArray(definition.nodes)
}

function sameLinkEnds(
  link: SerializedLink,
  other: SerializedLink | undefined
): boolean {
  return (
    other !== undefined &&
    link.origin_id === other.origin_id &&
    link.target_id === other.target_id &&
    link.target_slot === other.target_slot
  )
}

function serializedInput(
  graph: SerializedGraph,
  link: SerializedLink
): Pick<INodeInputSlot, 'name'> | undefined {
  return graph.nodes.get(link.target_id)?.inputs?.[link.target_slot]
}

function nodeFieldWrites(
  previous: SerializedNode,
  next: SerializedNode,
  liveTitle: string
): NodeFieldWrite[] {
  const writes: NodeFieldWrite[] = []
  if (previous.title !== next.title)
    writes.push({ field: 'title', value: liveTitle })
  if (previous.mode !== next.mode)
    writes.push({ field: 'mode', value: next.mode })
  for (const flag of ['collapsed', 'pinned'] as const) {
    const value = next.flags[flag] ?? null
    if ((previous.flags[flag] ?? null) !== value)
      writes.push({ field: `flags.${flag}`, value })
  }
  return writes
}

function namedWidgetValues(node: SerializedNode): ReadonlyMap<string, unknown> {
  const named: unknown = node.widgets_values_named
  return new Map(
    named !== null && typeof named === 'object' ? Object.entries(named) : []
  )
}

export function attachDocOpMinter(deps: DocOpMinterDeps): DocOpMinter {
  let pending: PendingOp[] = []
  let heldRestores: {
    workflow: ComfyWorkflow
    operations: GraphOperation[]
  } | null = null
  const pendingAdds = new Map<string, LGraphNode>()
  const pendingGrownSlots = new Map<string, PendingGrownSlot>()
  const pendingWidgetValues = new Map<string, PendingWidgetValue>()
  const reported = new Set<string>()
  const reportedRefusals = new Set<string>()
  const reportedPositionalDrops = new Set<string>()
  const heldPromotedWrites = new Map<string, HeldPromotedWrite>()
  let heldRetryTimer: ReturnType<typeof setTimeout> | null = null
  let grownSlotRetryTimer: ReturnType<typeof setTimeout> | null = null
  let flushScheduled = false
  let detached = false

  function grownSlotKey(
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

  function releaseGrownSlot(state: PendingGrownSlot): boolean {
    if (!deps.docInputNames(state.nodeId)?.includes(state.inputName))
      return false
    pendingGrownSlots.delete(pendingSlotKey(state))
    for (const deferred of state.deferred) schedule(deferred)
    return true
  }

  function pendingSlotKey(state: PendingGrownSlot): string {
    return grownSlotKey(state.rootGraphId, state.nodeId, state.inputName)
  }

  function dropRetargetedGrownSlot(state: PendingGrownSlot): boolean {
    const boundRootGraphId =
      deps.boundRootGraphId() ?? deps.getGraph()?.rootGraph.id ?? null
    if (boundRootGraphId === null || boundRootGraphId === state.rootGraphId)
      return false
    const key = pendingSlotKey(state)
    pendingGrownSlots.delete(key)
    reportOnce(
      `dynamic_slot_workflow_changed:${key}`,
      `Grown input ${state.inputName} of node ${String(state.nodeId)} belongs to graph ${state.rootGraphId}, which is no longer bound; dropping its deferred link operations rather than replaying them into ${boundRootGraphId}`,
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

  function dropExpiredGrownSlot(state: PendingGrownSlot): boolean {
    if (performance.now() - state.since < PROMOTED_WRITE_CATCH_UP_DEADLINE_MS)
      return false
    const key = pendingSlotKey(state)
    pendingGrownSlots.delete(key)
    reportOnce(
      `dynamic_slot_timeout:${key}`,
      `Grown input ${state.inputName} of node ${String(state.nodeId)} never reached the bound document; dropping its deferred link operations`,
      'agent_crdt_link_slot_not_in_doc',
      {
        nodeId: state.nodeId,
        input: state.inputName,
        operations: state.deferred.map(({ kind }) => kind)
      }
    )
    return true
  }

  function retryGrownSlots(): void {
    grownSlotRetryTimer = null
    if (detached) return
    if (!deps.isDocBound()) {
      holdGrownSlotsWhileUndeliverable()
      return
    }
    let waiting = false
    for (const state of pendingGrownSlots.values()) {
      if (dropRetargetedGrownSlot(state)) continue
      if (releaseGrownSlot(state) || dropExpiredGrownSlot(state)) continue
      waiting = true
    }
    if (waiting)
      grownSlotRetryTimer = setTimeout(retryGrownSlots, PROMOTED_WRITE_RETRY_MS)
  }

  function holdGrownSlotsWhileUndeliverable(): void {
    if (deps.boundRootGraphId() === null) {
      pendingGrownSlots.clear()
      return
    }
    const now = performance.now()
    for (const state of pendingGrownSlots.values()) state.since = now
    retryGrownSlotsSoon()
  }

  function retryGrownSlotsSoon(): void {
    if (grownSlotRetryTimer !== null) return
    grownSlotRetryTimer = setTimeout(retryGrownSlots, PROMOTED_WRITE_RETRY_MS)
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
    const snapshot = wireNodeSnapshot(node, (counts) =>
      reportOnce(
        `positional:${node.type}`,
        'agent_wire_positional_values_dropped',
        'agent_wire_positional_values_dropped',
        { nodeType: node.type, ...counts },
        reportedPositionalDrops
      )
    )
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
      const definition: SubgraphDefinition = JSON.parse(
        JSON.stringify(subgraph.asSerialisable())
      )
      for (const node of definition.nodes)
        if (typeof node === 'object' && node !== null)
          Reflect.deleteProperty(node, '__incarnation')
      return definition
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
    const operations = resolvePendingOps(batch)
    for (const state of pendingGrownSlots.values()) {
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

  function resolvePendingOps(batch: readonly PendingOp[]): GraphOperation[] {
    const hosts: SubgraphNode[] = []
    const operations = batch.flatMap((entry): GraphOperation[] => {
      switch (entry.kind) {
        case 'op':
          return [entry.operation]
        case 'promoted_write':
          return settledPromotedWrite(entry)
        case 'connect':
        case 'disconnect':
          return addressLinkOperation(entry)
        case 'add_node': {
          const operation = mintAddNodeOperation(entry.graph, entry.node)
          if (!operation) return []
          if (entry.node.isSubgraphNode()) hosts.push(entry.node)
          return [operation]
        }
      }
    })
    operations.push(...mintMissingDefinitions(hosts))
    return operations
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

  function noteVisibleUnboundEdit(eventRootGraphId: string): void {
    const rootGraph = deps.getGraph()?.rootGraph
    if (eventRootGraphId === rootGraph?.id)
      deps.onUnboundVisibleIntent?.(rootGraph)
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
      noteVisibleUnboundEdit(rootGraphId)
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

  function rootGraphIdForWidgetWrite(
    owner: LGraphNode | null,
    eventGraph: LGraph | Subgraph | null,
    graph: LGraph
  ) {
    const visibleRootGraphId = graph.rootGraph.id
    const rootGraphId = deps.boundRootGraphId() ?? visibleRootGraphId
    const ownerRootGraphId =
      owner?.graph?.rootGraph.id ?? eventGraph?.rootGraph.id
    if (
      ownerRootGraphId !== visibleRootGraphId ||
      visibleRootGraphId === rootGraphId
    )
      return rootGraphId
    noteVisibleUnboundEdit(ownerRootGraphId)
    return null
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
    const rootGraphId = rootGraphIdForWidgetWrite(owner, eventGraph, graph)
    if (rootGraphId === null) return
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
    schedule(scheduledWidgetOperation(routed, owner, rootGraphId, event))
  }

  function scheduledWidgetOperation(
    operation: GraphOperation,
    owner: LGraphNode | null,
    rootGraphId: string,
    event: IntentOf<'set_widget'>
  ): PendingOp {
    if (!isPromotedSetWidget(operation) || !owner)
      return { kind: 'op', operation }
    return {
      kind: 'promoted_write',
      operation,
      host: owner,
      mintedNames: promotedHostInputs(owner).map(({ input }) => input.name),
      rootGraphId,
      event
    }
  }

  function settledPromotedWrite(entry: PendingPromotedWrite): GraphOperation[] {
    const liveNames = promotedHostInputs(entry.host).map(
      ({ input }) => input.name
    )
    if (isEqual(liveNames, [...entry.mintedNames]))
      return [
        {
          ...entry.operation,
          promoted: promotedHostPayload(
            entry.host,
            entry.event.nodeId,
            liveNames.indexOf(entry.event.name)
          )
        }
      ]
    refuseWidgetWrite(entry.rootGraphId, entry.event, {
      reason: 'layout_changed',
      mintedNames: entry.mintedNames,
      liveNames
    })
    return []
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
    const key = `owner:${nodeKey(graphId, event.nodeId)}:${event.name}`
    if (reportedRefusals.has(key)) return
    reportedRefusals.add(key)
    reportLostEdit('mint_divergence', [{ op: 'set_widget' }], {
      code: 'unresolvable_widget_owner',
      errorType: 'agent_crdt_widget_owner_unresolved',
      graphId,
      nodeId: event.nodeId,
      widget: event.name
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
    else if (refusal.reason === 'doc_not_synced')
      giveUpUnsynced(rootGraphId, event)
    else refuseWidgetWrite(rootGraphId, event, refusal)
  }

  function giveUpUnsynced(
    rootGraphId: string,
    event: IntentOf<'set_widget'>
  ): void {
    if (deps.isPreMintBinding?.()) {
      deps.onUnboundLocalIntent?.()
      return
    }
    refuseWidgetWrite(rootGraphId, event, { reason: 'doc_not_synced' })
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
    else giveUpUnsynced(entry.rootGraphId, entry.event)
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
      case 'layout_changed': {
        const { mintedNames, liveNames } = refusal
        reportOnce(
          `promoted_layout_changed:${rootGraphId}:${host}:${event.name}`,
          `Writing ${event.name} on subgraph host ${host} changed its promoted inputs from [${mintedNames.join(', ')}] to [${liveNames.join(', ')}]; refusing to mint a promoted write the document cannot place`,
          'agent_crdt_promoted_widget_layout_changed',
          {
            nodeId: event.nodeId,
            widget: event.name,
            mintedNames,
            liveNames
          },
          reportedRefusals
        )
        return
      }
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

  function dropCancelledGrownSlots(removedNodeId: NodeId): void {
    const cancelled = [...pendingGrownSlots].filter(
      ([, state]) =>
        !state.sent &&
        !pending.some((entry) => isQueuedConnect(entry, state.growLinkId))
    )
    for (const [key] of cancelled) pendingGrownSlots.delete(key)
    for (const [, state] of cancelled)
      for (const entry of withoutCancelledAdd(state.deferred, removedNodeId))
        routeLinkOp(state.rootGraphId, entry)
  }

  function forgetPendingNodeState(nodeId: string): void {
    for (const [key, state] of pendingGrownSlots)
      if (state.nodeId === nodeId) pendingGrownSlots.delete(key)
    for (const [key, pending] of pendingWidgetValues)
      if (pending.nodeId === nodeId) pendingWidgetValues.delete(key)
  }

  function mintRemoveNode(event: IntentOf<'remove_node'>): void {
    if (!isMintableRootScope(event.graph, 'node_delete', event.node.id)) return
    forgetPendingNodeState(event.node.id)
    const key = nodeKey(event.graph.id, event.node.id)
    if (pendingAdds.get(key) === event.node) {
      pendingAdds.delete(key)
      pending = withoutCancelledAdd(pending, event.node.id)
      dropCancelledGrownSlots(event.node.id)
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
    { kind: action, operation, target }: PendingLinkOp,
    input: Pick<INodeInputSlot, 'name'>
  ): void {
    const { link_id: linkId, to_node: nodeId } = operation
    reportOnce(
      `${action}:${nodeId}:${input.name}`,
      `${action} targets input ${input.name} of node ${String(nodeId)}, which the bound document does not carry; the bound doc diverges from the local graph`,
      'agent_crdt_link_slot_not_in_doc',
      {
        action,
        linkId,
        nodeId,
        input: input.name,
        ...slotDivergenceShape(
          target.node,
          input,
          deps.docInputNames(target.nodeId)
        )
      }
    )
  }

  function addressLinkOperation(entry: PendingLinkOp): GraphOperation[] {
    const { target } = entry
    const docNames = deps.docInputNames(target.nodeId)
    if (entry.kind === 'disconnect') {
      const slot = documentInputIndex(docNames, target.input, target.liveSlot)
      if (slot !== undefined) return [{ ...entry.operation, to_slot: slot }]
    } else {
      const address = documentInputSlot(
        docNames,
        entry.target.node,
        entry.target.input,
        target.liveSlot
      )
      if (address.kind === 'slot')
        return [{ ...entry.operation, to_slot: address.slot }]
      if (address.kind === 'grow')
        return [{ ...entry.operation, to_slot: null, grow: address.grow }]
    }
    if (target.input) reportSlotNotInDoc(entry, target.input)
    return []
  }

  function linkTarget(graph: LGraph, link: LLink): LinkTarget {
    const node = graph.getNodeById(link.target_id) ?? undefined
    return {
      nodeId: link.target_id,
      node,
      input: node?.inputs[link.target_slot],
      liveSlot: link.target_slot
    }
  }

  function pendingGrownSlotOf(
    rootGraphId: string,
    { target }: PendingLinkOp
  ): PendingGrownSlot | undefined {
    if (!target.input) return undefined
    const state = pendingGrownSlots.get(
      grownSlotKey(rootGraphId, target.nodeId, target.input.name)
    )
    return state && !releaseGrownSlot(state) ? state : undefined
  }

  function deferToGrownSlot(
    state: PendingGrownSlot,
    entry: PendingLinkOp
  ): true {
    state.deferred.push(entry)
    retryGrownSlotsSoon()
    return true
  }

  function holdGrowConnect(
    rootGraphId: string,
    entry: Extract<PendingLinkOp, { kind: 'connect' }>
  ): boolean {
    const { target, operation } = entry
    const state = pendingGrownSlotOf(rootGraphId, entry)
    const address = documentInputSlot(
      deps.docInputNames(target.nodeId),
      target.node,
      target.input,
      target.liveSlot
    )
    if (address.kind !== 'grow' || !target.input) return false
    if (
      address.selection &&
      !documentMatchesSelection(target.nodeId, address.selection)
    ) {
      reportSlotNotInDoc(entry, target.input)
      return true
    }
    if (state) return deferToGrownSlot(state, entry)
    schedule(entry)
    pendingGrownSlots.set(
      grownSlotKey(rootGraphId, target.nodeId, target.input.name),
      {
        rootGraphId,
        nodeId: target.nodeId,
        inputName: target.input.name,
        growLinkId: operation.link_id,
        since: performance.now(),
        sent: false,
        deferred: []
      }
    )
    retryGrownSlotsSoon()
    return true
  }

  function holdGrowDisconnect(
    rootGraphId: string,
    entry: Extract<PendingLinkOp, { kind: 'disconnect' }>
  ): boolean {
    const state = pendingGrownSlotOf(rootGraphId, entry)
    if (!state) return false
    const linkId = entry.operation.link_id
    if (state.sent || state.growLinkId !== linkId)
      return deferToGrownSlot(state, entry)
    pending = pending.filter((queued) => !isQueuedConnect(queued, linkId))
    pendingGrownSlots.delete(pendingSlotKey(state))
    return true
  }

  function mintConnect(event: IntentOf<'connect'>): void {
    if (!isMintableRootScope(event.graph, 'connect', event.link.id)) return
    const { link } = event
    const entry: PendingLinkOp = {
      kind: 'connect',
      operation: {
        op: 'connect',
        link_id: link.id,
        from_node: link.origin_id,
        from_slot: link.origin_slot,
        to_node: link.target_id,
        link_type: String(link.type)
      },
      target: linkTarget(event.graph, link)
    }
    routeLinkOp(event.graph.rootGraph.id, entry)
  }

  function mintDisconnect(event: IntentOf<'disconnect'>): void {
    if (!isMintableRootScope(event.graph, 'disconnect', event.link.id)) return
    const { link } = event
    const entry: PendingLinkOp = {
      kind: 'disconnect',
      operation: {
        op: 'disconnect',
        link_id: link.id,
        to_node: link.target_id
      },
      target: linkTarget(event.graph, link)
    }
    routeLinkOp(event.graph.rootGraph.id, entry)
  }

  function routeLinkOp(rootGraphId: string, entry: PendingLinkOp): void {
    const held =
      entry.kind === 'connect'
        ? holdGrowConnect(rootGraphId, entry)
        : holdGrowDisconnect(rootGraphId, entry)
    if (!held) schedule(entry)
  }

  function mintClear(event: IntentOf<'clear'>): void {
    if (event.nodeIds.length === 0) return
    const boundRootGraphId = deps.boundRootGraphId()
    if (boundRootGraphId !== null && event.graphId !== boundRootGraphId) {
      noteVisibleUnboundEdit(event.graphId)
      reportOnce(
        `clear:${event.graphId}:${boundRootGraphId}`,
        `clear targets graph ${event.graphId}, not the bound document's root graph ${boundRootGraphId}; refusing to mint`,
        'agent_crdt_op_for_unbound_graph',
        { graphId: event.graphId, boundRootGraphId }
      )
      return
    }
    for (const [key, state] of pendingGrownSlots)
      if (event.nodeIds.includes(state.nodeId)) pendingGrownSlots.delete(key)
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

  function onRestore(restore: GraphRestore): void {
    if (!deps.isEnabled() || !deps.isBoundWorkflow(restore.workflow)) return
    if (deps.isDocBound()) {
      mintRestore(restore)
      return
    }
    const operations = restoreOperationsAtAccept(restore)
    heldRestores =
      heldRestores?.workflow === restore.workflow
        ? {
            workflow: restore.workflow,
            operations: [...heldRestores.operations, ...operations]
          }
        : { workflow: restore.workflow, operations }
    deps.onUnboundLocalIntent?.()
  }

  function restoreOperationsAtAccept(restore: GraphRestore): GraphOperation[] {
    const outer = pending
    pending = []
    mintRestore(restore)
    const accepted = pending
    pending = outer
    return resolvePendingOps(accepted)
  }

  function deliverHeldRestores(): void {
    if (!heldRestores) return
    if (!deps.isBoundWorkflow(heldRestores.workflow)) {
      heldRestores = null
      return
    }
    if (!deps.isDocBound()) return
    const { operations } = heldRestores
    heldRestores = null
    for (const operation of operations) schedule({ kind: 'op', operation })
  }

  function mintRestore({ graph, previous, next }: GraphRestore): void {
    if (!isMintableRootScope(graph, 'restore', graph.id)) return
    mintRestoredScope(graph, previous, next)
    const priorInteriors = subgraphInteriors(previous)
    for (const [id, interior] of subgraphInteriors(next)) {
      const prior = priorInteriors.get(id)
      const subgraph = graph.subgraphs.get(id)
      if (prior && subgraph) mintRestoredScope(subgraph, prior, interior)
    }
  }

  function mintRestoredScope(
    graph: LGraph,
    previous: RestoredScope,
    next: RestoredScope
  ): void {
    const before = serializedGraph(previous)
    const after = serializedGraph(next)
    const liveNodes = new Map(
      graph.nodes.map((node) => [String(node.id), node])
    )
    mintRestoredRemovals(graph, liveNodes, before, after)
    mintRestoredChanges(graph, liveNodes, before, after)
    mintRestoredAdditions(graph, liveNodes, before, after)
  }

  function mintRestoredRemovals(
    graph: LGraph,
    liveNodes: ReadonlyMap<string, LGraphNode>,
    before: SerializedGraph,
    after: SerializedGraph
  ): void {
    for (const id of before.nodes.keys()) {
      if (after.nodes.has(id)) continue
      if (!isMintableRootScope(graph, 'node_delete', id)) continue
      forgetPendingNodeState(id)
      const removedLinks = [...before.links.values()]
        .filter((link) => link.origin_id === id || link.target_id === id)
        .map((link) => link.id)
      schedule({
        kind: 'op',
        operation: {
          op: 'delete_node',
          node_id: id,
          removed_links: removedLinks
        }
      })
    }
    for (const link of before.links.values()) {
      const target = liveNodes.get(link.target_id)
      if (!target || !after.nodes.has(link.origin_id)) continue
      if (sameLinkEnds(link, after.links.get(link.id))) continue
      if (!isMintableRootScope(graph, 'disconnect', link.id)) continue
      routeLinkOp(graph.rootGraph.id, {
        kind: 'disconnect',
        operation: { op: 'disconnect', link_id: link.id, to_node: target.id },
        target: {
          nodeId: target.id,
          node: target,
          input: serializedInput(before, link),
          liveSlot: link.target_slot
        }
      })
    }
  }

  function mintRestoredAdditions(
    graph: LGraph,
    liveNodes: ReadonlyMap<string, LGraphNode>,
    before: SerializedGraph,
    after: SerializedGraph
  ): void {
    for (const [id, node] of liveNodes) {
      if (after.nodes.has(id) && !before.nodes.has(id))
        mintIntent({ type: 'add_node', graph, node, source: 'local' })
    }
    for (const live of graph.links.values()) {
      const link = after.links.get(live.id)
      if (link && !sameLinkEnds(link, before.links.get(live.id)))
        mintIntent({ type: 'connect', graph, link: live, source: 'local' })
    }
  }

  function mintRestoredChanges(
    graph: LGraph,
    liveNodes: ReadonlyMap<string, LGraphNode>,
    before: SerializedGraph,
    after: SerializedGraph
  ): void {
    for (const [id, node] of liveNodes) {
      const prior = before.nodes.get(id)
      const restored = after.nodes.get(id)
      if (!prior || !restored) continue
      for (const write of nodeFieldWrites(prior, restored, node.title))
        mintIntent({
          type: 'set_node_field',
          graph,
          nodeId: node.id,
          source: 'local',
          ...write
        })
      const priorValues = namedWidgetValues(prior)
      for (const [name, value] of namedWidgetValues(restored)) {
        const old = priorValues.get(name)
        if (!isEqual(old, value))
          mintIntent({
            type: 'set_widget',
            graphId: graph.id,
            nodeId: node.id,
            name,
            value,
            previous: old,
            source: 'local'
          })
      }
    }
  }

  function discardHeldWrite(event: GraphIntentEvent): void {
    if (event.type === 'set_widget')
      heldPromotedWrites.delete(heldWriteKey(event))
  }

  function intentRootGraphId(
    event: GraphIntentEvent,
    graph: LGraph | null
  ): string | null {
    if ('graph' in event) return event.graph.rootGraph.id
    return graph !== null && reachableIntentGraph(graph, event.graphId) !== null
      ? graph.id
      : null
  }

  function noteUnboundLocalIntent(event: GraphIntentEvent): void {
    const graph = deps.getGraph()
    const eventRootGraphId = intentRootGraphId(event, graph)
    if (eventRootGraphId === null) return
    if (eventRootGraphId === deps.boundRootGraphId())
      deps.onUnboundLocalIntent?.()
    else if (eventRootGraphId === graph?.rootGraph.id)
      deps.onUnboundVisibleIntent?.(graph.rootGraph)
  }

  function onIntent(event: GraphIntentEvent): void {
    if (event.source !== 'local') return
    if (deps.isEnabled() && deps.isDocBound()) {
      mintIntent(event)
      return
    }
    if (deps.isEnabled()) noteUnboundLocalIntent(event)
    discardHeldWrite(event)
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
  const detachRestores = onGraphRestored(onRestore)

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
    deliverHeldRestores,
    detach() {
      detached = true
      pending = []
      heldRestores = null
      pendingAdds.clear()
      pendingGrownSlots.clear()
      pendingWidgetValues.clear()
      heldPromotedWrites.clear()
      if (heldRetryTimer !== null) clearTimeout(heldRetryTimer)
      heldRetryTimer = null
      if (grownSlotRetryTimer !== null) clearTimeout(grownSlotRetryTimer)
      grownSlotRetryTimer = null
      detachIntents()
      detachRestores()
      unregisterDocBoundProbe()
    }
  }
}
