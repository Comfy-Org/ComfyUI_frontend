/**
 * Layout attachment for litegraph entities.
 *
 * Geometry joins and leaves the layout store with the entity that owns it, so
 * every attach/detach path — including bulk teardown — goes through these
 * helpers rather than re-deriving the store writes by hand.
 *
 * Each attached instance holds a private `{ graphId, id }` descriptor captured
 * at attach time. The store is purely ID-addressed; detach clears the
 * descriptor before changing the store so stale instances cannot write.
 */
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphGroup } from '@/lib/litegraph/src/LGraphGroup'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { Reroute } from '@/lib/litegraph/src/Reroute'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import type {
  LayoutOperation,
  LayoutOperationResult,
  Point,
  Size
} from '@/renderer/core/layout/types'
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

/** Layout mutations attributed to the canvas, for direct delete calls. */
export function canvasLayoutMutations() {
  const mutations = useLayoutMutations()
  mutations.setSource(LayoutSource.Canvas)
  return mutations
}

/** Stamps the canvas as the operation source and returns the shared meta. */
function canvasOperationMeta() {
  layoutStore.setSource(LayoutSource.Canvas)
  return {
    actor: layoutStore.getCurrentActor(),
    source: layoutStore.getCurrentSource(),
    timestamp: Date.now()
  }
}

export interface AttachOptions {
  /** Adopt an existing store entry for this id instead of failing to create. */
  adoptExisting?: boolean
}

/** A newly attached node stacks above those already attached. */
export function attachNodeLayout(
  graph: LayoutGraph,
  node: LGraphNode,
  options: AttachOptions = {}
): LayoutOperationResult {
  if (nodeAttachments.has(node)) detachNodeLayout(node)

  const graphId = graph.rootGraph.id
  const position = { x: node._pos[0], y: node._pos[1] }
  const size = { width: node._size[0], height: node._size[1] }
  const result = layoutStore.applyOperation({
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
  if (result === 'applied') {
    adoptNodeAttachment(graphId, node)
    return result
  }
  if (
    result === 'no-op' &&
    options.adoptExisting &&
    layoutStore.getNodeLayout(graphId, node.id)
  ) {
    adoptNodeAttachment(graphId, node)
    return 'applied'
  }
  return result
}

function adoptNodeAttachment(graphId: UUID, node: LGraphNode): void {
  nodeAttachments.set(node, { graphId, id: node.id })
  node._layoutRegistered = true
  node._geometryVersion = layoutStore.geometryVersion
}

export function detachNodeLayout(node: LGraphNode): LayoutOperationResult {
  const attachment = nodeAttachments.get(node)
  if (!attachment) return 'no-op'
  const { graphId, id: nodeId } = attachment

  layoutStore.readNodeRect(graphId, nodeId, node._posSize)
  nodeAttachments.delete(node)
  node._layoutRegistered = false
  const result = layoutStore.applyOperation({
    ...canvasOperationMeta(),
    entity: 'node',
    graphId,
    nodeId,
    type: 'deleteNode'
  })
  if (result === 'rejected') {
    nodeAttachments.set(node, attachment)
    node._layoutRegistered = true
  }
  return result
}

export function attachGroupLayout(
  graph: LayoutGraph,
  group: LGraphGroup,
  options: AttachOptions = {}
): LayoutOperationResult {
  const graphId = graph.rootGraph.id
  const result = layoutStore.applyOperation({
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
  if (result === 'applied') {
    groupAttachments.set(group, { graphId, id: group.id })
    return result
  }
  if (
    result === 'no-op' &&
    options.adoptExisting &&
    layoutStore.getGroupLayout(graphId, group.id)
  ) {
    groupAttachments.set(group, { graphId, id: group.id })
    return 'applied'
  }
  return result
}

export function detachGroupLayout(group: LGraphGroup): LayoutOperationResult {
  const attachment = groupAttachments.get(group)
  if (!attachment) return 'no-op'
  groupAttachments.delete(group)
  const result = layoutStore.applyOperation({
    ...canvasOperationMeta(),
    entity: 'group',
    graphId: attachment.graphId,
    groupId: attachment.id,
    type: 'deleteGroup'
  })
  if (result === 'rejected') groupAttachments.set(group, attachment)
  return result
}

function attachRerouteLayout(
  graph: LayoutGraph,
  reroute: Reroute,
  position: Point
): LayoutOperationResult {
  const graphId = graph.rootGraph.id
  const result = layoutStore.applyOperation({
    ...canvasOperationMeta(),
    entity: 'reroute',
    graphId,
    position,
    rerouteId: reroute.id,
    type: 'createReroute'
  })
  if (result === 'applied') {
    rerouteAttachments.set(reroute, { graphId, id: reroute.id })
  }
  return result
}

/** Attaches a reroute, adopting an existing store entry when one exists. */
export function materializeRerouteLayout(
  graph: LayoutGraph,
  reroute: Reroute,
  position?: Point
): LayoutOperationResult {
  const graphId = graph.rootGraph.id
  if (layoutStore.getRerouteLayout(graphId, reroute.id)) {
    rerouteAttachments.set(reroute, { graphId, id: reroute.id })
    return 'applied'
  }
  return attachRerouteLayout(
    graph,
    reroute,
    position ?? { x: reroute.pos[0], y: reroute.pos[1] }
  )
}

export function detachRerouteLayout(reroute: Reroute): LayoutOperationResult {
  const attachment = rerouteAttachments.get(reroute)
  if (!attachment) return 'no-op'
  syncReroutePositionFromLayout(reroute)
  rerouteAttachments.delete(reroute)
  const result = layoutStore.applyOperation({
    ...canvasOperationMeta(),
    entity: 'reroute',
    graphId: attachment.graphId,
    rerouteId: attachment.id,
    type: 'deleteReroute'
  })
  if (result === 'rejected') rerouteAttachments.set(reroute, attachment)
  return result
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

/**
 * Drops every layout entry a graph owns, including those inside the subgraph
 * definitions it holds, in one store transaction. Mirrors
 * `unregisterAllNodeStates`; call it from the same places, before the entity
 * containers are emptied.
 */
export function detachAllGraphLayout(
  graph: GraphLayoutOwner
): LayoutOperationResult {
  const meta = canvasOperationMeta()
  const operations: LayoutOperation[] = []
  const undoLocal: (() => void)[] = []
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
      operations.push({
        ...meta,
        entity: 'node',
        graphId: attachment.graphId,
        nodeId: attachment.id,
        type: 'deleteNode'
      })
      undoLocal.push(() => {
        nodeAttachments.set(node, attachment)
        node._layoutRegistered = true
      })
    }
    for (const group of owner._groups) {
      const attachment = groupAttachments.get(group)
      if (!attachment) continue
      groupAttachments.delete(group)
      operations.push({
        ...meta,
        entity: 'group',
        graphId: attachment.graphId,
        groupId: attachment.id,
        type: 'deleteGroup'
      })
      undoLocal.push(() => groupAttachments.set(group, attachment))
    }
    for (const reroute of owner.reroutes.values()) {
      const attachment = rerouteAttachments.get(reroute)
      if (!attachment) continue
      syncReroutePositionFromLayout(reroute)
      rerouteAttachments.delete(reroute)
      operations.push({
        ...meta,
        entity: 'reroute',
        graphId: attachment.graphId,
        rerouteId: attachment.id,
        type: 'deleteReroute'
      })
      undoLocal.push(() => rerouteAttachments.set(reroute, attachment))
    }
    for (const subgraph of owner._subgraphs.values()) collect(subgraph)
  }

  collect(graph)
  const result = layoutStore.applyOperations(operations)
  if (result === 'rejected') {
    console.warn('[GraphLayoutAttachment] Bulk layout detach rejected')
    for (const undo of undoLocal) undo()
  }
  return result
}
