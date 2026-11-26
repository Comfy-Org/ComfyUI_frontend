import type {
  Point2D,
  RectSide as Direction
} from '@comfyorg/shared-frontend-utils/geometry'
import { arrangePlacements } from '@comfyorg/graph-model/arrange/arrange'
import type {
  AlignAction,
  Axis,
  Placement,
  VisualBox
} from '@comfyorg/graph-model/arrange/arrange'
import type { NodeId } from '@comfyorg/graph-model/nodeId'

import type { Positionable } from '@comfyorg/graph-model/interfaces'

import { LGraphGroup } from '@/lib/litegraph/src/LGraphGroup'
import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { computeUnionBounds } from '@/utils/mathUtil'

export interface NewNodePosition {
  node: LGraphNode
  newPos: Point2D
}

export interface IBoundaryNodes {
  top: LGraphNode
  right: LGraphNode
  bottom: LGraphNode
  left: LGraphNode
}

function measuredRect(node: LGraphNode) {
  if (node.boundingRect.every((value) => value === 0)) node.updateArea()
  return node.boundingRect
}

/** The node's visual bounds, title band included, measured first if it has never been drawn. */
export function nodeBox(node: LGraphNode): VisualBox {
  const [x, y, width, height] = measuredRect(node)
  const titleHeight = Math.max(0, Math.min(height, node.boundingOffset[1]))
  return { x, y, width, height, titleHeight }
}

/** The visual bounds of any canvas item; only nodes and groups have a title band. */
export function positionableBox(item: Positionable): VisualBox {
  if (item instanceof LGraphNode) return nodeBox(item)
  const [x, y, width, height] = item.boundingRect
  const titleHeight = item instanceof LGraphGroup ? item.titleHeight : 0
  return {
    x,
    y,
    width,
    height,
    titleHeight: Math.max(0, Math.min(height, titleHeight))
  }
}

/** The union of the items' visual bounds, with the title band of the topmost item. */
export function unionBox(items: Positionable[]): VisualBox | undefined {
  const bounds = computeUnionBounds(items.map((item) => item.boundingRect))
  if (!bounds) return
  const top = items.reduce((a, b) =>
    b.boundingRect[1] < a.boundingRect[1] ? b : a
  )
  return { ...bounds, titleHeight: positionableBox(top).titleHeight }
}

/** Each node's current placement, by id. */
export function placementsOf(nodes: LGraphNode[]): Map<NodeId, Placement> {
  return new Map(
    nodes.map((node) => [
      node.id,
      { position: { x: node.pos[0], y: node.pos[1] }, box: nodeBox(node) }
    ])
  )
}

function arrangeNodes(
  nodes: LGraphNode[],
  action: AlignAction,
  reference?: LGraphNode
): NewNodePosition[] {
  const isDistribute = action === 'distributeX' || action === 'distributeY'
  const framed = isDistribute ? nodes.filter((node) => !node.pinned) : nodes
  const after = arrangePlacements(
    placementsOf(framed),
    action,
    reference && nodeBox(reference)
  )
  return framed.flatMap((node) => {
    const placement = after.get(node.id)
    return placement && !node.pinned
      ? [{ node, newPos: placement.position }]
      : []
  })
}

/**
 * Finds the nodes that are farthest in all four directions, representing the boundary of the nodes.
 * @returns `null` if no nodes were supplied.
 */
export function getBoundaryNodes(nodes: LGraphNode[]): IBoundaryNodes | null {
  if (nodes.length === 0) return null
  const valid = nodes[0]

  let top = valid
  let right = valid
  let bottom = valid
  let left = valid

  for (const node of nodes) {
    const [x, y] = node.pos
    const [width, height] = node.size

    if (y < top.pos[1]) top = node
    if (x + width > right.pos[0] + right.size[0]) right = node
    if (y + height > bottom.pos[1] + bottom.size[1]) bottom = node
    if (x < left.pos[0]) left = node
  }

  return { top, right, bottom, left }
}

/** Positions that space the unpinned nodes' visual boxes evenly along `axis` between the outermost ones. */
export function distributeNodes(
  nodes: LGraphNode[],
  axis: Axis
): NewNodePosition[] {
  return arrangeNodes(nodes, axis === 'x' ? 'distributeX' : 'distributeY')
}

/** Positions that line the unpinned nodes up on one edge of the selection, or of `align_to` when given. */
export function alignNodes(
  nodes: LGraphNode[],
  direction: Direction,
  align_to?: LGraphNode
): NewNodePosition[] {
  return arrangeNodes(nodes, direction, align_to)
}
