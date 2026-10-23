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
  Op,
  PromotedHostWrite,
  SubgraphDefinition,
  WidgetValuesForm,
  WorkflowNode
} from '@comfyorg/comfy-multi-player'
import { isEqual } from 'es-toolkit'

import { documentInputSlot } from '@/core/graph/widgets/documentSlots'
import type { DocumentSlotNames } from '@/core/graph/widgets/documentSlots'
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
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { reportError } from '@/platform/telemetry/reportError'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { RootGraphId } from '@/types/graphScopeId'
import type { NodeId } from '@/types/nodeId'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import type { WidgetState } from '@/types/widgetState'
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
  /** Drops the predicted slots of grows the host settled without applying. */
  forgetUnappliedGrows(ops: readonly Op[]): void
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
  graphId: string
  nodeId: NodeId
  node: LGraphNode | undefined
  input: INodeInputSlot | undefined
  liveSlot: number
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
      target: LinkTarget
    }

type PendingOp =
  | { kind: 'add_node'; graph: LGraph; node: LGraphNode }
  | { kind: 'op'; operation: GraphOperation }
  | PendingLinkOp

interface UnechoedGrows {
  base: number
  names: readonly string[]
}

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
  const form = nodeLocalWidgetForm(node, values)
  return form
    ? { ...snapshot, widgets_values: values, widgets_values_form: form }
    : { ...snapshot, widgets_values: values }
}

const VALUE_DEPENDENT_LAYOUT_INPUT_TYPES = new Set([
  'COMFY_AUTOGROW_V3',
  'COMFY_DYNAMICCOMBO_V3',
  'COMFY_DYNAMICGROUP_V3'
])

function nodeLocalWidgetForm(
  node: LGraphNode,
  values: Record<string, unknown>
): WidgetValuesForm | undefined {
  const definition = useNodeDefStore().fromLGraphNode(node)
  const layoutDependsOnValues = Object.values(definition?.inputs ?? {}).some(
    (spec) => VALUE_DEPENDENT_LAYOUT_INPUT_TYPES.has(spec.type)
  )
  if (layoutDependsOnValues) return undefined
  const order = (node.widgets ?? [])
    .map((widget) => widget.name)
    .filter((name) => Object.hasOwn(values, name))
  const isClosed =
    order.length > 0 &&
    order.length === Object.keys(values).length &&
    order.every((name) => name.length > 0) &&
    new Set(order).size === order.length
  return isClosed ? { order } : undefined
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
        return true
    }
  })
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
  const unechoedGrows = new Map<string, UnechoedGrows>()
  const reported = new Set<string>()
  const reportedRefusals = new Set<string>()
  const heldPromotedWrites = new Map<string, HeldPromotedWrite>()
  let heldRetryTimer: ReturnType<typeof setTimeout> | null = null
  let flushScheduled = false
  let detached = false

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
    const operations = batch.flatMap((entry): GraphOperation[] => {
      switch (entry.kind) {
        case 'op':
          return [entry.operation]
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
    schedule({ kind: 'op', operation: routed })
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
    const key = nodeKey(event.graph.id, event.node.id)
    unechoedGrows.delete(key)
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
    { kind: action, operation }: PendingLinkOp,
    input: INodeInputSlot
  ): void {
    const { link_id: linkId, to_node: nodeId } = operation
    reportOnce(
      `${action}:${nodeId}:${input.name}`,
      `${action} targets input ${input.name} of node ${String(nodeId)}, which the bound document does not carry; the bound doc diverges from the local graph`,
      'agent_crdt_link_slot_not_in_doc',
      { action, linkId, nodeId, input: input.name }
    )
  }

  function inFlightGrows(
    key: string,
    docNames: DocumentSlotNames
  ): UnechoedGrows | undefined {
    const grows = unechoedGrows.get(key)
    if (!grows?.names.every((name) => docNames.includes(name))) return grows
    unechoedGrows.delete(key)
    return undefined
  }

  function expectedDocInputNames(
    docNames: DocumentSlotNames,
    grows: UnechoedGrows | undefined
  ): DocumentSlotNames {
    if (grows === undefined) return docNames
    const echoed = docNames.slice(grows.base)
    const onlyOurEchoes =
      docNames.length >= grows.base &&
      echoed.every((name, index) => name === grows.names[index])
    if (!onlyOurEchoes) return docNames
    return [...docNames, ...grows.names.slice(echoed.length)]
  }

  function recordUnechoedGrow(key: string, docLength: number, name: string) {
    const grows = unechoedGrows.get(key)
    unechoedGrows.set(key, {
      base: grows?.base ?? docLength,
      names: [...(grows?.names ?? []), name]
    })
  }

  function forgetUnappliedGrows(ops: readonly Op[]): void {
    const graphId = deps.boundRootGraphId() ?? deps.getGraph()?.id
    if (graphId === undefined) return
    for (const op of ops) {
      if (op.op !== 'connect' || !op.grow) continue
      const key = nodeKey(graphId, toNodeId(op.to_node))
      const grows = unechoedGrows.get(key)
      if (!grows) continue
      const names = grows.names.filter((name) => name !== op.grow.name)
      if (names.length === 0) unechoedGrows.delete(key)
      else unechoedGrows.set(key, { base: grows.base, names })
    }
  }

  function addressLinkOperation(entry: PendingLinkOp): GraphOperation[] {
    const { target } = entry
    const key = nodeKey(target.graphId, target.nodeId)
    const docNames = deps.docInputNames(target.nodeId)
    const grows = docNames ? inFlightGrows(key, docNames) : undefined
    const address = documentInputSlot(
      docNames && expectedDocInputNames(docNames, grows),
      target.node,
      target.input,
      target.liveSlot
    )
    if (address.kind === 'slot')
      return [{ ...entry.operation, to_slot: address.slot }]
    if (
      address.kind === 'grow' &&
      entry.kind === 'connect' &&
      docNames &&
      !grows?.names.includes(address.grow.name)
    ) {
      recordUnechoedGrow(key, docNames.length, address.grow.name)
      return [{ ...entry.operation, to_slot: null, grow: address.grow }]
    }
    if (target.input) reportSlotNotInDoc(entry, target.input)
    return []
  }

  function linkTarget(graph: LGraph, link: LLink): LinkTarget {
    const node = graph.getNodeById(link.target_id) ?? undefined
    return {
      graphId: graph.id,
      nodeId: link.target_id,
      node,
      input: node?.inputs[link.target_slot],
      liveSlot: link.target_slot
    }
  }

  function mintConnect(event: IntentOf<'connect'>): void {
    if (!isMintableRootScope(event.graph, 'connect', event.link.id)) return
    const { link } = event
    schedule({
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
    })
  }

  function mintDisconnect(event: IntentOf<'disconnect'>): void {
    if (!isMintableRootScope(event.graph, 'disconnect', event.link.id)) return
    const { link } = event
    schedule({
      kind: 'disconnect',
      operation: {
        op: 'disconnect',
        link_id: link.id,
        to_node: link.target_id
      },
      target: linkTarget(event.graph, link)
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
    for (const nodeId of event.nodeIds)
      unechoedGrows.delete(nodeKey(event.graphId, nodeId))
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
    forgetUnappliedGrows,
    detach() {
      detached = true
      pending = []
      pendingAdds.clear()
      unechoedGrows.clear()
      heldPromotedWrites.clear()
      if (heldRetryTimer !== null) clearTimeout(heldRetryTimer)
      heldRetryTimer = null
      detachIntents()
      unregisterDocBoundProbe()
    }
  }
}
