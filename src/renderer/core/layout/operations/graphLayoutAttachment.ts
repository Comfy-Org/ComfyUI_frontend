import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphGroup } from '@/lib/litegraph/src/LGraphGroup'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { Reroute } from '@/lib/litegraph/src/Reroute'
import { createMutationView } from '@/lib/litegraph/src/infrastructure/createMutationView'
import { Rectangle } from '@/lib/litegraph/src/infrastructure/Rectangle'
import type {
  Point as LegacyPoint,
  Size as LegacySize
} from '@/lib/litegraph/src/interfaces'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import type { LayoutOperation, Point, Size } from '@/renderer/core/layout/types'
import { UNASSIGNED_NODE_ID } from '@/types/nodeId'
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
const nodeAttachmentOwners = new Map<
  UUID,
  Map<LGraphNode['id'], WeakRef<LGraphNode>>
>()

function nodeAttachmentOwner(
  graphId: UUID,
  nodeId: LGraphNode['id']
): LGraphNode | undefined {
  return nodeAttachmentOwners.get(graphId)?.get(nodeId)?.deref()
}

function setNodeAttachmentOwner(graphId: UUID, node: LGraphNode): void {
  let owners = nodeAttachmentOwners.get(graphId)
  if (!owners) {
    owners = new Map()
    nodeAttachmentOwners.set(graphId, owners)
  }
  owners.set(node.id, new WeakRef(node))
}

function deleteNodeAttachmentOwner(graphId: UUID, node: LGraphNode): boolean {
  const owners = nodeAttachmentOwners.get(graphId)
  if (owners?.get(node.id)?.deref() !== node) return false
  owners.delete(node.id)
  if (owners.size === 0) nodeAttachmentOwners.delete(graphId)
  return true
}
interface NodeGeometryProjection {
  buffer: Rectangle
  geometryVersion: number
  position: LegacyPoint
  positionView: LegacyPoint
  renderedSize: LegacySize
  size: LegacySize
  sizeView: LegacySize
}

const nodeGeometryProjections = new WeakMap<
  LGraphNode,
  NodeGeometryProjection
>()
const storedRectScratch = new Float64Array(4)

function nodeGeometryProjection(node: LGraphNode): NodeGeometryProjection {
  const existing = nodeGeometryProjections.get(node)
  if (existing) return existing

  const buffer = new Rectangle()
  const position = buffer.pos
  const size = buffer.size
  const projection: NodeGeometryProjection = {
    buffer,
    geometryVersion: -1,
    position,
    positionView: createMutationView(position, {
      commit: () => commitNodePosition(node),
      synchronize: () => refreshNodeGeometry(node)
    }),
    renderedSize: [0, 0],
    size,
    sizeView: createMutationView(size, {
      commit: () => commitNodeSize(node),
      synchronize: () => refreshNodeGeometry(node)
    })
  }
  nodeGeometryProjections.set(node, projection)
  return projection
}

export function nodeGeometryBuffer(node: LGraphNode): Rectangle {
  return nodeGeometryProjection(node).buffer
}

export function nodePositionBuffer(node: LGraphNode): LegacyPoint {
  return nodeGeometryProjection(node).position
}

export function nodeSizeBuffer(node: LGraphNode): LegacySize {
  return nodeGeometryProjection(node).size
}

export function nodePositionView(node: LGraphNode): LegacyPoint {
  return nodeGeometryProjection(node).positionView
}

export function nodeSizeView(node: LGraphNode): LegacySize {
  return nodeGeometryProjection(node).sizeView
}

export function refreshNodeGeometry(node: LGraphNode): LegacySize {
  const projection = nodeGeometryProjection(node)
  const attachment = nodeAttachments.get(node)
  if (
    attachment &&
    projection.geometryVersion !== layoutStore.geometryVersion
  ) {
    projection.geometryVersion = layoutStore.geometryVersion
    layoutStore.readNodeRect(
      attachment.graphId,
      attachment.id,
      projection.buffer
    )
  }

  const contentSize = attachment
    ? layoutStore.contentSizeOf(attachment.graphId, attachment.id)
    : undefined
  projection.renderedSize[0] = Math.max(
    projection.size[0],
    contentSize?.width ?? 0
  )
  projection.renderedSize[1] = Math.max(
    projection.size[1],
    contentSize?.height ?? 0
  )
  return projection.renderedSize
}

export function setNodePosition(node: LGraphNode, value: LegacyPoint): void {
  const position = nodeGeometryProjection(node).position
  position[0] = value[0]
  position[1] = value[1]
  commitNodePosition(node)
}

function commitNodePosition(node: LGraphNode): void {
  const attachment = nodeAttachments.get(node)
  if (node.id === UNASSIGNED_NODE_ID || !attachment) return
  const projection = nodeGeometryProjection(node)
  const position = { x: projection.position[0], y: projection.position[1] }
  if (
    layoutStore.readNodeRect(
      attachment.graphId,
      attachment.id,
      storedRectScratch
    ) &&
    storedRectScratch[0] === position.x &&
    storedRectScratch[1] === position.y
  )
    return

  moveNodeLayout(node, position)
  projection.geometryVersion = -1
  refreshNodeGeometry(node)
}

export function setNodeSize(node: LGraphNode, value: LegacySize): void {
  const size = nodeGeometryProjection(node).size
  size[0] = value[0]
  size[1] = value[1]
  commitNodeSize(node)
}

function commitNodeSize(node: LGraphNode): void {
  const attachment = nodeAttachments.get(node)
  if (node.id === UNASSIGNED_NODE_ID || !attachment) return
  const projection = nodeGeometryProjection(node)
  if (
    layoutStore.readNodeRect(
      attachment.graphId,
      attachment.id,
      storedRectScratch
    ) &&
    storedRectScratch[2] === projection.size[0] &&
    storedRectScratch[3] === projection.size[1]
  )
    return

  resizeNodeLayout(node, {
    width: projection.size[0],
    height: projection.size[1]
  })
  projection.geometryVersion = -1
  refreshNodeGeometry(node)
}
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
  const projection = nodeGeometryProjection(node)
  const geometrySynchronized = layoutStore.readNodeRect(
    graphId,
    node.id,
    projection.buffer
  )
  nodeAttachments.set(node, { graphId, id: node.id })
  setNodeAttachmentOwner(graphId, node)
  if (geometrySynchronized) {
    projection.geometryVersion = layoutStore.geometryVersion
  }
}

function transferableNodeAttachment(
  node: LGraphNode,
  replacement: LGraphNode
): LayoutAttachment<LGraphNode['id']> | undefined {
  const attachment = nodeAttachments.get(node)
  if (
    !attachment ||
    nodeAttachments.has(replacement) ||
    attachment.id !== replacement.id ||
    nodeAttachmentOwner(attachment.graphId, attachment.id) !== node ||
    !layoutStore.getNodeLayout(attachment.graphId, attachment.id)
  )
    return
  return attachment
}

export function canTransferLayoutAttachment(
  node: LGraphNode,
  replacement: LGraphNode
): boolean {
  return transferableNodeAttachment(node, replacement) !== undefined
}

export function transferLayoutAttachment(
  node: LGraphNode,
  replacement: LGraphNode
): boolean {
  const attachment = transferableNodeAttachment(node, replacement)
  if (!attachment) return false

  const geometrySynchronized = layoutStore.readNodeRect(
    attachment.graphId,
    attachment.id,
    nodeGeometryProjection(replacement).buffer
  )

  nodeAttachments.delete(node)
  nodeAttachments.set(replacement, attachment)
  setNodeAttachmentOwner(attachment.graphId, replacement)
  if (geometrySynchronized) {
    nodeGeometryProjection(replacement).geometryVersion =
      layoutStore.geometryVersion
  }
  return true
}

export function detachNodeLayout(node: LGraphNode): void {
  const attachment = nodeAttachments.get(node)
  if (!attachment) return
  const { graphId, id: nodeId } = attachment

  layoutStore.readNodeRect(graphId, nodeId, nodeGeometryProjection(node).buffer)
  nodeAttachments.delete(node)
  if (!deleteNodeAttachmentOwner(graphId, node)) return
  layoutStore.applyOperation({
    ...canvasOperationMeta(),
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
    group.syncBoundsFromStore()
    groupAttachments.set(group, { graphId, id: group.id })
    return
  }

  layoutStore.applyOperation({
    ...canvasOperationMeta(),
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
  group.syncBoundsFromStore()
  groupAttachments.delete(group)
  layoutStore.applyOperation({
    ...canvasOperationMeta(),
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
  reroute.syncPosition()
  rerouteAttachments.delete(reroute)
  layoutStore.applyOperation({
    ...canvasOperationMeta(),
    graphId: attachment.graphId,
    rerouteId: attachment.id,
    type: 'deleteReroute'
  })
}

function moveNodeLayout(node: LGraphNode, position: Point): void {
  const attachment = nodeAttachments.get(node)
  if (!attachment) return
  layoutStore.applyOperation({
    ...canvasOperationMeta(),
    graphId: attachment.graphId,
    nodeId: attachment.id,
    position,
    type: 'moveNode'
  })
}

export function resizeNodeLayout(
  node: LGraphNode,
  size: Size,
  {
    position,
    source = LayoutSource.Canvas
  }: { position?: Point; source?: LayoutSource } = {}
): void {
  const attachment = nodeAttachments.get(node)
  if (!attachment) return
  if (position) {
    layoutStore.batchUpdateNodeBounds(
      attachment.graphId,
      [
        {
          nodeId: attachment.id,
          bounds: { ...position, ...size }
        }
      ],
      { source }
    )
    return
  }
  layoutStore.applyOperation({
    graphId: attachment.graphId,
    nodeId: attachment.id,
    size,
    source,
    timestamp: Date.now(),
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
    graphId: attachment.graphId,
    position,
    rerouteId: attachment.id,
    type: 'moveReroute'
  })
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
      layoutStore.readNodeRect(
        attachment.graphId,
        attachment.id,
        nodeGeometryProjection(node).buffer
      )
      nodeAttachments.delete(node)
      const owned = deleteNodeAttachmentOwner(attachment.graphId, node)
      if (meta && owned) {
        operations.push({
          ...meta,
          graphId: attachment.graphId,
          nodeId: attachment.id,
          type: 'deleteNode'
        })
      }
    }
    for (const group of owner._groups) {
      const attachment = groupAttachments.get(group)
      if (!attachment) continue
      group.syncBoundsFromStore()
      groupAttachments.delete(group)
      if (meta) {
        operations.push({
          ...meta,
          graphId: attachment.graphId,
          groupId: attachment.id,
          type: 'deleteGroup'
        })
      }
    }
    for (const reroute of owner.reroutes.values()) {
      const attachment = rerouteAttachments.get(reroute)
      if (!attachment) continue
      reroute.syncPosition()
      rerouteAttachments.delete(reroute)
      if (meta) {
        operations.push({
          ...meta,
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
