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
 * nothing; a widget write on a node whose add is still pending is already in
 * that snapshot.
 */
import type { WorkflowNode } from '@comfyorg/comfy-multi-player'

import { registerDocBoundRootGraphProbe } from '@/lib/litegraph/src/docBoundGraphs'
import { onGraphIntent } from '@/lib/litegraph/src/graphIntents'
import type { GraphIntentEvent } from '@/lib/litegraph/src/graphIntents'
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { reportError } from '@/platform/telemetry/reportError'
import type { RootGraphId } from '@/types/graphScopeId'
import type { NodeId } from '@/types/nodeId'
import { findSubgraphNodePathById } from '@/utils/graphTraversalUtil'

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
}

export interface DocOpMinter {
  detach(): void
}

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
function wireNodeSnapshot(node: LGraphNode): WorkflowNode | null {
  let serialized: Record<string, unknown>
  try {
    serialized = node.serialize() as unknown as Record<string, unknown>
  } catch {
    return null
  }
  delete serialized.__incarnation
  const named = serialized.widgets_values_named
  if (named != null && typeof named === 'object') {
    if (!node.isVirtualNode)
      serialized.widgets_values = valueWidgetsOnly(node, named)
    delete serialized.widgets_values_named
  }
  const flags = serialized.flags
  if (flags != null && typeof flags === 'object' && 'ghost' in flags) {
    const { ghost: _ghost, ...rest } = flags
    serialized.flags = rest
  }
  return serialized as unknown as WorkflowNode
}

function valueWidgetsOnly(
  node: LGraphNode,
  named: object
): Record<string, unknown> {
  const filtered: Record<string, unknown> = {}
  for (const [name, value] of Object.entries(named)) {
    const widget = node.widgets?.find((candidate) => candidate.name === name)
    if (widget && widget.type !== 'button' && widget.serialize !== false) {
      filtered[name] = value
    }
  }
  return filtered
}

function nodeKey(graphId: string, nodeId: NodeId): string {
  return `${graphId}:${String(nodeId)}`
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
    reportError(new Error(message), { errorType, context })
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

  function mintSetWidget(
    event: Extract<GraphIntentEvent, { type: 'set_widget' }>
  ): void {
    if (pendingAdds.has(nodeKey(event.graphId, event.nodeId))) return
    const graph = deps.getGraph()
    if (!graph) return
    const rootGraphId = deps.boundRootGraphId() ?? graph.id
    const operation = {
      op: 'set_widget',
      node_id: event.nodeId,
      widget: event.name,
      value: event.value,
      old: event.previous
    } as const
    if (event.graphId === rootGraphId) {
      schedule({ kind: 'op', operation })
      return
    }
    const subgraphNodePath = findSubgraphNodePathById(graph, event.graphId)
    if (subgraphNodePath === null || subgraphNodePath.length === 0) {
      console.error(
        '[agent-crdt] set_widget with an unresolvable owner not minted; the bound doc diverges from the local graph',
        nodeKey(event.graphId, event.nodeId) + `:${event.name}`
      )
      return
    }
    const [head, ...rest] = subgraphNodePath
    schedule({
      kind: 'op',
      operation: {
        ...operation,
        path: [head, ...rest, String(event.nodeId)],
        inner_widget: event.name
      }
    })
  }

  function onIntent(event: GraphIntentEvent): void {
    if (event.source !== 'local') return
    if (!deps.isEnabled() || !deps.isDocBound()) return
    switch (event.type) {
      case 'add_node': {
        if (!isMintableRootScope(event.graph, 'node_create', event.node.id))
          return
        pendingAdds.set(nodeKey(event.graph.id, event.node.id), event.node)
        schedule({ kind: 'add_node', graph: event.graph, node: event.node })
        return
      }
      case 'remove_node': {
        if (!isMintableRootScope(event.graph, 'node_delete', event.node.id))
          return
        const key = nodeKey(event.graph.id, event.node.id)
        if (pendingAdds.get(key) === event.node) {
          pendingAdds.delete(key)
          pending = pending.filter(
            (entry) => entry.kind !== 'add_node' || entry.node !== event.node
          )
          return
        }
        schedule({
          kind: 'op',
          operation: {
            op: 'delete_node',
            node_id: event.node.id,
            removed_links: event.removedLinkIds
          }
        })
        return
      }
      case 'connect': {
        if (!isMintableRootScope(event.graph, 'connect', event.link.id)) return
        const { link } = event
        schedule({
          kind: 'op',
          operation: {
            op: 'connect',
            link_id: link.id,
            from_node: link.origin_id,
            from_slot: link.origin_slot,
            to_node: link.target_id,
            to_slot: link.target_slot,
            link_type: String(link.type)
          }
        })
        return
      }
      case 'disconnect': {
        if (!isMintableRootScope(event.graph, 'disconnect', event.link.id))
          return
        const { link } = event
        schedule({
          kind: 'op',
          operation: {
            op: 'disconnect',
            link_id: link.id,
            to_node: link.target_id,
            to_slot: link.target_slot
          }
        })
        return
      }
      case 'clear': {
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
          operation: { op: 'clear', removed_nodes: event.nodeIds }
        })
        return
      }
      case 'set_widget':
        mintSetWidget(event)
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
