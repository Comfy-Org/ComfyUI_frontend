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
import { onGraphIntent } from '@/lib/litegraph/src/graphIntents'
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
import type { RootGraphId } from '@/types/graphScopeId'
import type { NodeId } from '@/types/nodeId'
import type { WidgetValue } from '@/types/simplifiedWidget'
import { widgetId } from '@/types/widgetId'
import type { WidgetState } from '@/types/widgetState'
import {
  findNodeInHierarchy,
  findSubgraphByUuid,
  findSubgraphNodePathById,
  traverseSubgraphPath
} from '@/utils/graphTraversalUtil'

import type { GraphOperation } from './graphOperations'

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
   * The bound document's widget-backed input names for a node, in document
   * order, or null when the document holds no such node. Indexes the opaque
   * `widgets_values` a promoted write addresses.
   */
  docPromotedWidgetNames(nodeId: NodeId): readonly (string | undefined)[] | null
}

export interface DocOpMinter {
  detach(): void
}

type IntentOf<T extends GraphIntentEvent['type']> = Extract<
  GraphIntentEvent,
  { type: T }
>

type PendingOp =
  | { kind: 'add_node'; graph: LGraph; node: LGraphNode }
  | { kind: 'op'; operation: GraphOperation }

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
  const {
    widgets_values_named: named,
    flags: { ghost: _ghost, ...flags },
    ...rest
  } = serialized
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
 * `value_index` indexes the DOCUMENT's array, so it is resolved against the
 * document's own widget-backed input order rather than the live one, which
 * drifts from it (`reorderSubgraphInputsByWidgetOrder` permutes the live host
 * without minting anything). A name the document does not carry fails closed
 * — the named op is minted and refused as before, rather than landing on
 * whatever register sits at that index. The live order stands in only while
 * the document has no such node yet, exactly as `docInputIndex` does for a
 * link's target slot. The inbound leg (`applyHostWidgets`) still reads the
 * array in LIVE order and has not been moved to this basis.
 */
function promotedHostWrite(
  node: LGraphNode | null,
  event: IntentOf<'set_widget'>,
  docPromotedNames: () => readonly (string | undefined)[] | null
): PromotedHostWrite | null {
  if (!node?.isSubgraphNode()) return null
  const liveNames = node.inputs.flatMap((input) =>
    input.widgetId ? [input.name] : []
  )
  const order = docPromotedNames() ?? liveNames
  const valueIndex = order.indexOf(event.name)
  if (valueIndex === -1) return null
  const rootGraphId = node.graph?.rootGraph.id ?? event.graphId
  return {
    value_index: valueIndex,
    instance_path: [String(event.nodeId)],
    host_widgets_values: order.map((name, index) =>
      index === valueIndex
        ? event.value
        : hostWidgetValue(rootGraphId, event.nodeId, name)
    )
  }
}

/**
 * A promoted sibling's current value, read exactly as
 * `SubgraphNode.serializeFromStoreState` reads it so the array a write
 * extends the document from agrees with the one a save would have written.
 */
function hostWidgetValue(
  rootGraphId: string,
  nodeId: NodeId,
  name: string | undefined
): WidgetValue | undefined {
  if (name === undefined) return undefined
  const value = useWidgetValueStore().getWidget(
    widgetId(rootGraphId, nodeId, name)
  )?.value
  return isWidgetValue(value) ? value : undefined
}

function routedWidgetOperation(
  graph: LGraph,
  rootGraphId: string,
  event: IntentOf<'set_widget'>,
  node: LGraphNode | null,
  docPromotedNames: () => readonly (string | undefined)[] | null
): GraphOperation | null {
  const operation = {
    op: 'set_widget',
    node_id: event.nodeId,
    widget: event.name,
    value: event.value,
    old: event.previous
  } as const
  const owningGraphId = node?.graph?.id ?? event.graphId
  if (owningGraphId === rootGraphId) {
    const promoted = promotedHostWrite(node, event, docPromotedNames)
    return promoted ? { ...operation, promoted } : operation
  }
  const subgraphNodePath = findSubgraphNodePathById(graph, owningGraphId)
  if (subgraphNodePath === null || subgraphNodePath.length === 0) {
    console.error(
      '[agent-crdt] set_widget with an unresolvable owner not minted; the bound doc diverges from the local graph',
      nodeKey(owningGraphId, event.nodeId) + `:${event.name}`
    )
    return null
  }
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
  let flushScheduled = false
  let detached = false

  function schedule(op: PendingOp): void {
    pending.push(op)
    if (flushScheduled) return
    flushScheduled = true
    queueMicrotask(flush)
  }

  function flush(): void {
    flushScheduled = false
    reported.clear()
    const batch = pending
    pending = []
    pendingAdds.clear()
    if (detached) return
    const operations: GraphOperation[] = []
    for (const entry of batch) {
      if (entry.kind === 'op') {
        operations.push(entry.operation)
        continue
      }
      const { graph, node } = entry
      if (node.graph !== graph) continue
      const snapshot = wireNodeSnapshot(node)
      if (!snapshot) {
        console.error(
          '[agent-crdt] add_node mint dropped: no snapshot for node',
          node.id
        )
        continue
      }
      operations.push({
        op: 'add_node',
        node_id: node.id,
        class_type: snapshot.type,
        pos: [node.pos[0], node.pos[1]],
        node: snapshot
      })
    }
    if (operations.length > 0) deps.enqueue(operations)
  }

  function reportOnce(
    key: string,
    message: string,
    errorType: string,
    context: Record<string, unknown>
  ): void {
    if (reported.has(key)) return
    reported.add(key)
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

  function mintSetWidget(event: IntentOf<'set_widget'>): void {
    if (pendingAdds.has(nodeKey(event.graphId, event.nodeId))) return
    const graph = deps.getGraph()
    if (!graph) return
    const eventGraph = reachableIntentGraph(graph, event.graphId)
    const owner = eventGraph
      ? findNodeInHierarchy(eventGraph, event.nodeId)
      : null
    if (!isValueWidgetWrite(owner, event)) return
    const rootGraphId = deps.boundRootGraphId() ?? graph.id
    const operation = routedWidgetOperation(
      graph,
      rootGraphId,
      event,
      owner,
      () => deps.docPromotedWidgetNames(event.nodeId)
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
    const graph = deps.getGraph()
    if (!graph) return null
    return graph.rootGraph.id
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
