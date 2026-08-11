import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphGroup } from '@/lib/litegraph/src/LGraphGroup'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { Reroute } from '@/lib/litegraph/src/Reroute'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import type { LayoutOperation, Point, Size } from '@/renderer/core/layout/types'
import type { UUID } from '@/utils/uuid'

type GraphLayoutOwner = Pick<
  LGraph,
  '_nodes' | '_groups' | '_subgraphs' | 'reroutes'
>
type LayoutGraph = { rootGraph: { id: UUID } }

interface LayoutAttachment<TId> {
  graphId: UUID
  id: TId
}

const nodeAttachments = new WeakMap<
  LGraphNode,
  LayoutAttachment<LGraphNode['id']>
>()
const groupAttachments = new WeakMap<
  LGraphGroup,
  LayoutAttachment<LGraphGroup['id']>
>()
const rerouteAttachments = new WeakMap<
  Reroute,
  LayoutAttachment<Reroute['id']>
>()

/** Shared operation meta attributing the operation to the canvas. */
function canvasOperationMeta() {
  return {
    source: LayoutSource.Canvas,
    timestamp: Date.now()
  }
}

/** A newly attached node stacks above those already attached. */
export function attachNodeLayout(graph: LayoutGraph, node: LGraphNode): void {
  if (nodeAttachments.has(node)) detachNodeLayout(node)

  const graphId = graph.rootGraph.id
  if (layoutStore.getNodeLayout(graphId, node.id)) {
    adoptNodeAttachment(graphId, node)
    return
  }

  const position = { x: node._pos[0], y: node._pos[1] }
  const size = { width: node._size[0], height: node._size[1] }
  layoutStore.applyOperation({
    ...canvasOperationMeta(),
    entity: 'node',
    graphId,
    layout: {
      bounds: { ...position, ...size },
      id: node.id,
      position,
      size,
      zIndex: layoutStore.allocateZIndex(),
      visible: true
    },
    nodeId: node.id,
    type: 'createNode'
  })
  adoptNodeAttachment(graphId, node)
}

function adoptNodeAttachment(graphId: UUID, node: LGraphNode): void {
  if (!layoutStore.readNodeRect(graphId, node.id, node._posSize)) return
  nodeAttachments.set(node, { graphId, id: node.id })
  node._layoutRegistered = true
  node._geometryVersion = layoutStore.geometryVersion
}

export function detachNodeLayout(node: LGraphNode): void {
  const attachment = nodeAttachments.get(node)
  if (!attachment) return
  const { graphId, id: nodeId } = attachment

  layoutStore.readNodeRect(graphId, nodeId, node._posSize)
  nodeAttachments.delete(node)
  node._layoutRegistered = false
  layoutStore.applyOperation({
    ...canvasOperationMeta(),
    entity: 'node',
    graphId,
    nodeId,
    type: 'deleteNode'
  })
}

export function attachGroupLayout(
  graph: LayoutGraph,
  group: LGraphGroup
): void {
  const graphId = graph.rootGraph.id
  if (layoutStore.getGroupLayout(graphId, group.id)) {
    syncGroupBoundsFromLayout(group)
    groupAttachments.set(group, { graphId, id: group.id })
    return
  }

  layoutStore.applyOperation({
    ...canvasOperationMeta(),
    entity: 'group',
    graphId,
    groupId: group.id,
    layout: {
      id: group.id,
      position: { x: group.pos[0], y: group.pos[1] },
      size: { width: group.size[0], height: group.size[1] }
    },
    type: 'createGroup'
  })
  groupAttachments.set(group, { graphId, id: group.id })
}

export function detachGroupLayout(group: LGraphGroup): void {
  const attachment = groupAttachments.get(group)
  if (!attachment) return
  syncGroupBoundsFromLayout(group)
  groupAttachments.delete(group)
  layoutStore.applyOperation({
    ...canvasOperationMeta(),
    entity: 'group',
    graphId: attachment.graphId,
    groupId: attachment.id,
    type: 'deleteGroup'
  })
}

/** Attaches a reroute, adopting an existing store entry when one exists. */
export function materializeRerouteLayout(
  graph: LayoutGraph,
  reroute: Reroute
): void {
  const graphId = graph.rootGraph.id
  if (layoutStore.getRerouteLayout(graphId, reroute.id)) {
    rerouteAttachments.set(reroute, { graphId, id: reroute.id })
    return
  }

  layoutStore.applyOperation({
    ...canvasOperationMeta(),
    entity: 'reroute',
    graphId,
    position: { x: reroute.pos[0], y: reroute.pos[1] },
    rerouteId: reroute.id,
    type: 'createReroute'
  })
  rerouteAttachments.set(reroute, { graphId, id: reroute.id })
}

export function detachRerouteLayout(reroute: Reroute): void {
  const attachment = rerouteAttachments.get(reroute)
  if (!attachment) return
  syncReroutePositionFromLayout(reroute)
  rerouteAttachments.delete(reroute)
  layoutStore.applyOperation({
    ...canvasOperationMeta(),
    entity: 'reroute',
    graphId: attachment.graphId,
    rerouteId: attachment.id,
    type: 'deleteReroute'
  })
}

export function moveNodeLayout(node: LGraphNode, position: Point): void {
  const attachment = nodeAttachments.get(node)
  if (!attachment) return
  layoutStore.applyOperation({
    ...canvasOperationMeta(),
    entity: 'node',
    graphId: attachment.graphId,
    nodeId: attachment.id,
    position,
    type: 'moveNode'
  })
}

export function resizeNodeLayout(node: LGraphNode, size: Size): void {
  const attachment = nodeAttachments.get(node)
  if (!attachment) return
  layoutStore.applyOperation({
    ...canvasOperationMeta(),
    entity: 'node',
    graphId: attachment.graphId,
    nodeId: attachment.id,
    size,
    type: 'resizeNode'
  })
}

export function setGroupBoundsLayout(
  group: LGraphGroup,
  position: Point,
  size: Size
): void {
  const attachment = groupAttachments.get(group)
  if (!attachment) return
  layoutStore.applyOperation({
    ...canvasOperationMeta(),
    entity: 'group',
    graphId: attachment.graphId,
    groupId: attachment.id,
    position,
    size,
    type: 'setGroupBounds'
  })
}

export function moveRerouteLayout(reroute: Reroute, position: Point): void {
  const attachment = rerouteAttachments.get(reroute)
  if (!attachment) return
  layoutStore.applyOperation({
    ...canvasOperationMeta(),
    entity: 'reroute',
    graphId: attachment.graphId,
    position,
    rerouteId: attachment.id,
    type: 'moveReroute'
  })
}

/**
 * Reads the reroute position through its geometry-view Proxy, which copies
 * the store position into the reroute's local buffer before detach.
 */
function syncReroutePositionFromLayout(reroute: Reroute): void {
  void reroute.pos[0]
}

function syncGroupBoundsFromLayout(group: LGraphGroup): void {
  void group.pos[0]
}

/**
 * Invalidates every attachment a graph owns, including those inside its
 * subgraph definitions. Layout entries are removed in one store transaction
 * unless their graph bucket will be cleared separately.
 */
export function detachGraphLayouts(
  graphs: readonly GraphLayoutOwner[],
  { removeLayouts = true }: { removeLayouts?: boolean } = {}
): void {
  const meta = removeLayouts ? canvasOperationMeta() : undefined
  const operations: LayoutOperation[] = []
  const visited = new Set<GraphLayoutOwner>()

  function collect(owner: GraphLayoutOwner): void {
    if (visited.has(owner)) return
    visited.add(owner)
    for (const node of owner._nodes) {
      const attachment = nodeAttachments.get(node)
      if (!attachment) continue
      layoutStore.readNodeRect(attachment.graphId, attachment.id, node._posSize)
      nodeAttachments.delete(node)
      node._layoutRegistered = false
      if (meta) {
        operations.push({
          ...meta,
          entity: 'node',
          graphId: attachment.graphId,
          nodeId: attachment.id,
          type: 'deleteNode'
        })
      }
    }
    for (const group of owner._groups) {
      const attachment = groupAttachments.get(group)
      if (!attachment) continue
      syncGroupBoundsFromLayout(group)
      groupAttachments.delete(group)
      if (meta) {
        operations.push({
          ...meta,
          entity: 'group',
          graphId: attachment.graphId,
          groupId: attachment.id,
          type: 'deleteGroup'
        })
      }
    }
    for (const reroute of owner.reroutes.values()) {
      const attachment = rerouteAttachments.get(reroute)
      if (!attachment) continue
      syncReroutePositionFromLayout(reroute)
      rerouteAttachments.delete(reroute)
      if (meta) {
        operations.push({
          ...meta,
          entity: 'reroute',
          graphId: attachment.graphId,
          rerouteId: attachment.id,
          type: 'deleteReroute'
        })
      }
    }
    for (const subgraph of owner._subgraphs.values()) collect(subgraph)
  }

  for (const graph of graphs) collect(graph)
  if (removeLayouts) layoutStore.applyOperations(operations)
}
