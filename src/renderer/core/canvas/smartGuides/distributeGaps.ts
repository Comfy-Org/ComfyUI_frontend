import { ALIGNED_EPSILON } from './snapSolver'
import type { Axis, SnapBox } from './snapSolver'

type RowEnd = 'start' | 'end'

const sizeAlong = (box: SnapBox, axis: Axis) =>
  axis === 'x' ? box.width : box.height

const endAlong = (box: SnapBox, axis: Axis) => box[axis] + sizeAlong(box, axis)

export function orderAlong(boxes: SnapBox[], axis: Axis) {
  return boxes
    .map((box, index) => ({ box, index }))
    .sort((a, b) => a.box[axis] - b.box[axis])
}

/** The shared gap between consecutive ordered boxes, or `undefined` when the gaps differ. */
export function evenGap(ordered: SnapBox[], axis: Axis): number | undefined {
  if (ordered.length < 2) return
  const gaps = ordered
    .slice(1)
    .map((box, i) => box[axis] - endAlong(ordered[i], axis))
  const [first] = gaps
  return gaps.every((gap) => Math.abs(gap - first) <= ALIGNED_EPSILON)
    ? first
    : undefined
}

export function spaceEvenly(
  ordered: SnapBox[],
  axis: Axis,
  gap: number,
  fixed: RowEnd = 'start'
): SnapBox[] {
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

function fixedEnd(index: number, gapCount: number): RowEnd {
  return index >= (gapCount - 1) / 2 ? 'start' : 'end'
}

/** The gap that keeps the dragged handle under the pointer after it travels `travel` canvas units. */
export function gapAfterTravel(
  ordered: SnapBox[],
  axis: Axis,
  index: number,
  travel: number
): number {
  const gap = evenGap(ordered, axis) ?? 0
  const gapCount = ordered.length - 1
  const rate = {
    start: 1 / (index + 0.5),
    end: -1 / (gapCount - index - 0.5)
  }[fixedEnd(index, gapCount)]
  return gap + travel * rate
}

/** Respaces ordered boxes to a whole-unit `gap`, anchored on the side away from handle `index`. */
export function setGap(
  ordered: SnapBox[],
  axis: Axis,
  index: number,
  gap: number
): SnapBox[] {
  return spaceEvenly(
    ordered,
    axis,
    Math.max(0, Math.round(gap)),
    fixedEnd(index, ordered.length - 1)
  )
}
