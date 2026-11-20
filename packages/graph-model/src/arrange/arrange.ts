import type {
  Bounds,
  Point2D,
  RectSide as Direction
} from '@comfyorg/shared-frontend-utils/geometry'

import type { NodeId } from '@comfyorg/graph-model/nodeId'

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

type RowEnd = 'start' | 'end'

const LANE_TOLERANCE = 20

const sizeAlong = (box: VisualBox, axis: Axis) =>
  axis === 'x' ? box.width : box.height

const endAlong = (box: VisualBox, axis: Axis) =>
  box[axis] + sizeAlong(box, axis)

const bodyHeight = (box: VisualBox) => box.height - box.titleHeight

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

function laneIndices(boxes: VisualBox[], axis: Axis): number[][] {
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
  const lanes = laneIndices(boxes, axis)
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

/** Groups ids into lanes of boxes that overlap or line up along `axis`, ordered by lane start. */
export function lanesAlong(
  boxes: ReadonlyMap<NodeId, VisualBox>,
  axis: Axis
): NodeId[][] {
  const ids = [...boxes.keys()]
  return laneIndices([...boxes.values()], axis).map((lane) =>
    lane.map((index) => ids[index])
  )
}

/** Where a node sits: its layout position and the visual box it occupies there. */
export interface Placement {
  position: Point2D
  box: VisualBox
}

/** The placement that puts the visual box at `box`, keeping the offset between position and box. */
export function placeBox(
  { position, box: from }: Placement,
  box: VisualBox
): Placement {
  return {
    position: {
      x: position.x + box.x - from.x,
      y: position.y + box.y - from.y
    },
    box
  }
}

/** The new placement of every node after aligning, sizing, or distributing; alignment uses `reference` instead of the placements' extent when given. */
export function arrangePlacements(
  placements: ReadonlyMap<NodeId, Placement>,
  action: AlignAction,
  reference?: VisualBox
): Map<NodeId, Placement> {
  const entries = [...placements]
  const after = alignBoxes(
    entries.map(([, { box }]) => box),
    action,
    reference
  )
  return new Map(
    entries.map(([id, placement], i) => [id, placeBox(placement, after[i])])
  )
}

/** The visual box of each placement, by node. */
export function boxesOf(
  placements: ReadonlyMap<NodeId, Placement>
): Map<NodeId, VisualBox> {
  return new Map([...placements].map(([id, { box }]) => [id, box]))
}
