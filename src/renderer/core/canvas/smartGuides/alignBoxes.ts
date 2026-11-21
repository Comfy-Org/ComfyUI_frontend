import { orderAlong, spaceEvenly } from './distributeGaps'
import type { Axis, SnapBox } from './snapSolver'

export type AlignAction =
  | 'left'
  | 'center'
  | 'right'
  | 'top'
  | 'middle'
  | 'bottom'
  | 'matchWidth'
  | 'matchHeight'
  | 'distributeX'
  | 'distributeY'

const bodyHeight = (b: SnapBox) => b.height - b.titleHeight

const sizeAlong = (box: SnapBox, axis: Axis) =>
  axis === 'x' ? box.width : box.height

const LANE_TOLERANCE = 20

function sameLane(p: SnapBox, q: SnapBox, axis: Axis): boolean {
  const near = (a: number, b: number) => Math.abs(a - b) <= LANE_TOLERANCE
  const bodyStart = (box: SnapBox) =>
    axis === 'y' ? box.y + box.titleHeight : box.x
  const p0 = p[axis]
  const p1 = p0 + sizeAlong(p, axis)
  const q0 = q[axis]
  const q1 = q0 + sizeAlong(q, axis)
  return (
    near(bodyStart(p), bodyStart(q)) ||
    near(p1, q1) ||
    near((p0 + p1) / 2, (q0 + q1) / 2) ||
    (p0 >= q0 && p1 <= q1) ||
    (q0 >= p0 && q1 <= p1)
  )
}

/** Groups box indices into lanes of boxes that overlap or line up along `axis`, ordered by lane start. */
export function lanesAlong(boxes: SnapBox[], axis: Axis): number[][] {
  return orderAlong(boxes, axis)
    .reduce<number[][]>((lanes, { index }) => {
      const joins = (lane: number[]) =>
        lane.some((other) => sameLane(boxes[index], boxes[other], axis))
      return [
        ...lanes.filter((lane) => !joins(lane)),
        [...lanes.filter(joins).flat(), index]
      ]
    }, [])
    .sort(
      (p, q) =>
        laneBox(
          p.map((i) => boxes[i]),
          axis
        )[axis] -
        laneBox(
          q.map((i) => boxes[i]),
          axis
        )[axis]
    )
}

/** The box spanning every member of a lane along `axis`. */
export function laneBox(members: SnapBox[], axis: Axis): SnapBox {
  const start = Math.min(...members.map((b) => b[axis]))
  const end = Math.max(...members.map((b) => b[axis] + sizeAlong(b, axis)))
  const size = axis === 'x' ? { width: end - start } : { height: end - start }
  return { ...members[0], [axis]: start, ...size }
}

function distribute(boxes: SnapBox[], axis: Axis): SnapBox[] {
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
  const span = last[axis] + sizeAlong(last, axis) - first[axis]
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

/** Aligns, sizes, or distributes boxes; returns them in the same order. */
export function alignBoxes(boxes: SnapBox[], action: AlignAction): SnapBox[] {
  if (boxes.length < 2) return boxes
  const minX = Math.min(...boxes.map((b) => b.x))
  const maxRight = Math.max(...boxes.map((b) => b.x + b.width))
  const minY = Math.min(...boxes.map((b) => b.y))
  const maxBottom = Math.max(...boxes.map((b) => b.y + b.height))
  const minBodyTop = Math.min(...boxes.map((b) => b.y + b.titleHeight))

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
      const width = Math.max(...boxes.map((b) => b.width))
      return boxes.map((b) => ({ ...b, width }))
    }
    case 'matchHeight': {
      const body = Math.max(...boxes.map(bodyHeight))
      return boxes.map((b) => ({ ...b, height: body + b.titleHeight }))
    }
    case 'distributeX':
      return distribute(boxes, 'x')
    case 'distributeY':
      return distribute(boxes, 'y')
  }
}
