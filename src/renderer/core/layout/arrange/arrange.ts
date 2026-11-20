import type {
  Bounds,
  Point2D,
  RectSide as Direction
} from '@comfyorg/shared-frontend-utils/geometry'
import type { LGraphNode } from '@comfyorg/graph-model/entityRegistry'

export type Axis = 'x' | 'y'

/** Visual bounds in canvas units; `titleHeight` is the title band above the body. */
export interface VisualBox extends Bounds {
  titleHeight: number
}

export type AlignAction =
  | Direction
  | 'center'
  | 'middle'
  | 'matchWidth'
  | 'matchHeight'
  | 'distributeX'
  | 'distributeY'

export const ALIGNED_EPSILON = 0.5

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

type RowEnd = 'start' | 'end'

const LANE_TOLERANCE = 20

const sizeAlong = (box: VisualBox, axis: Axis) =>
  axis === 'x' ? box.width : box.height

const endAlong = (box: VisualBox, axis: Axis) =>
  box[axis] + sizeAlong(box, axis)

const bodyHeight = (box: VisualBox) => box.height - box.titleHeight

/** The node's visual bounds, title band included. */
export function nodeBox(node: LGraphNode): VisualBox {
  const [x, y, width, height] = node.boundingRect
  const titleHeight = Math.max(0, Math.min(height, node.boundingOffset[1]))
  return { x, y, width, height, titleHeight }
}

export interface NodePlacement {
  node: LGraphNode
  x: number
  y: number
  box: VisualBox
}

export function nodePlacement(node: LGraphNode): NodePlacement {
  return { node, x: node.pos[0], y: node.pos[1], box: nodeBox(node) }
}

/** The node position that puts its visual box at `box`. */
export function positionForBox(
  { x, y, box: from }: NodePlacement,
  box: VisualBox
): Point2D {
  return { x: x + box.x - from.x, y: y + box.y - from.y }
}

function orderAlong(boxes: VisualBox[], axis: Axis) {
  return boxes
    .map((box, index) => ({ box, index }))
    .sort((a, b) => a.box[axis] - b.box[axis])
}

/** The shared gap between consecutive ordered boxes, or `undefined` when the gaps differ. */
export function evenGap(ordered: VisualBox[], axis: Axis): number | undefined {
  if (ordered.length < 2) return
  const gaps = ordered
    .slice(1)
    .map((box, i) => box[axis] - endAlong(ordered[i], axis))
  const [first] = gaps
  return gaps.every((gap) => Math.abs(gap - first) <= ALIGNED_EPSILON)
    ? first
    : undefined
}

/** Places ordered boxes `gap` apart, keeping the `fixed` end of the row where it is. */
export function spaceEvenly(
  ordered: VisualBox[],
  axis: Axis,
  gap: number,
  fixed: RowEnd = 'start'
): VisualBox[] {
  const first = ordered[0]
  const last = ordered[ordered.length - 1]
  const total =
    ordered.reduce((sum, box) => sum + sizeAlong(box, axis), 0) +
    gap * (ordered.length - 1)
  const origin = {
    start: first[axis],
    end: endAlong(last, axis) - total
  }[fixed]

  let cursor = origin
  return ordered.map((box) => {
    const placed = { ...box, [axis]: cursor }
    cursor += sizeAlong(box, axis) + gap
    return placed
  })
}

function sameLane(p: VisualBox, q: VisualBox, axis: Axis): boolean {
  const near = (a: number, b: number) => Math.abs(a - b) <= LANE_TOLERANCE
  const bodyStart = (box: VisualBox) =>
    axis === 'y' ? box.y + box.titleHeight : box.x
  const p0 = p[axis]
  const p1 = endAlong(p, axis)
  const q0 = q[axis]
  const q1 = endAlong(q, axis)
  return (
    near(bodyStart(p), bodyStart(q)) ||
    near(p1, q1) ||
    near((p0 + p1) / 2, (q0 + q1) / 2) ||
    (p0 >= q0 && p1 <= q1) ||
    (q0 >= p0 && q1 <= p1)
  )
}

/** Groups box indices into lanes of boxes that overlap or line up along `axis`, ordered by lane start. */
export function lanesAlong(boxes: VisualBox[], axis: Axis): number[][] {
  const startOf = (lane: number[]) =>
    laneBox(
      lane.map((i) => boxes[i]),
      axis
    )[axis]
  return orderAlong(boxes, axis)
    .reduce<number[][]>((lanes, { index }) => {
      const joins = (lane: number[]) =>
        lane.some((other) => sameLane(boxes[index], boxes[other], axis))
      return [
        ...lanes.filter((lane) => !joins(lane)),
        [...lanes.filter(joins).flat(), index]
      ]
    }, [])
    .sort((p, q) => startOf(p) - startOf(q))
}

/** The box spanning every member of a lane along `axis`. */
export function laneBox(members: VisualBox[], axis: Axis): VisualBox {
  const start = Math.min(...members.map((b) => b[axis]))
  const end = Math.max(...members.map((b) => endAlong(b, axis)))
  const size = axis === 'x' ? { width: end - start } : { height: end - start }
  return { ...members[0], [axis]: start, ...size }
}

function distribute(boxes: VisualBox[], axis: Axis): VisualBox[] {
  const lanes = lanesAlong(boxes, axis)
  if (lanes.length < 3) return boxes
  const before = lanes.map((lane) =>
    laneBox(
      lane.map((i) => boxes[i]),
      axis
    )
  )
  const first = before[0]
  const last = before[before.length - 1]
  const span = endAlong(last, axis) - first[axis]
  const total = before.reduce((sum, b) => sum + sizeAlong(b, axis), 0)
  const gap = (span - total) / (lanes.length - 1)
  if (gap < 0) return boxes
  const after = spaceEvenly(before, axis, gap)

  const result = [...boxes]
  lanes.forEach((lane, i) => {
    const shift = after[i][axis] - before[i][axis]
    for (const index of lane)
      result[index] = { ...boxes[index], [axis]: boxes[index][axis] + shift }
  })
  return result
}

/** Aligns, sizes, or distributes boxes, returned in the same order; alignment uses `reference` instead of the boxes' extent when given. */
export function alignBoxes(
  boxes: VisualBox[],
  action: AlignAction,
  reference?: VisualBox
): VisualBox[] {
  if (boxes.length < (reference ? 1 : 2)) return boxes
  const frame = reference ? [reference] : boxes
  const minX = Math.min(...frame.map((b) => b.x))
  const maxRight = Math.max(...frame.map((b) => b.x + b.width))
  const minY = Math.min(...frame.map((b) => b.y))
  const maxBottom = Math.max(...frame.map((b) => b.y + b.height))
  const minBodyTop = Math.min(...frame.map((b) => b.y + b.titleHeight))

  switch (action) {
    case 'left':
      return boxes.map((b) => ({ ...b, x: minX }))
    case 'center':
      return boxes.map((b) => ({ ...b, x: (minX + maxRight - b.width) / 2 }))
    case 'right':
      return boxes.map((b) => ({ ...b, x: maxRight - b.width }))
    case 'top':
      return boxes.map((b) => ({ ...b, y: minBodyTop - b.titleHeight }))
    case 'middle':
      return boxes.map((b) => ({ ...b, y: (minY + maxBottom - b.height) / 2 }))
    case 'bottom':
      return boxes.map((b) => ({ ...b, y: maxBottom - b.height }))
    case 'matchWidth': {
      const width = Math.max(...frame.map((b) => b.width))
      return boxes.map((b) => ({ ...b, width }))
    }
    case 'matchHeight': {
      const body = Math.max(...frame.map(bodyHeight))
      return boxes.map((b) => ({ ...b, height: body + b.titleHeight }))
    }
    case 'distributeX':
      return distribute(boxes, 'x')
    case 'distributeY':
      return distribute(boxes, 'y')
  }
}

function arrangeNodes(
  nodes: LGraphNode[],
  action: AlignAction,
  reference?: LGraphNode
): NewNodePosition[] {
  const placements = nodes.filter((node) => !node.pinned).map(nodePlacement)
  const after = alignBoxes(
    placements.map(({ box }) => box),
    action,
    reference && nodeBox(reference)
  )
  return placements.map((placement, i) => ({
    node: placement.node,
    newPos: positionForBox(placement, after[i])
  }))
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

/** Positions that space the unpinned nodes' visual boxes evenly between the outermost ones. */
export function distributeNodes(
  nodes: LGraphNode[],
  horizontal?: boolean
): NewNodePosition[] {
  return arrangeNodes(nodes, horizontal ? 'distributeX' : 'distributeY')
}

/** Positions that line the unpinned nodes up on one edge of the selection, or of `align_to` when given. */
export function alignNodes(
  nodes: LGraphNode[],
  direction: Direction,
  align_to?: LGraphNode
): NewNodePosition[] {
  return arrangeNodes(nodes, direction, align_to)
}
