import type { SnapBox } from '@/lib/litegraph/src/canvas/gestureSnap'

export type DistributeAxis = 'x' | 'y'

type Anchor = 'start' | 'end'

const EQUAL_EPSILON = 0.5

const sizeAlong = (box: SnapBox, axis: DistributeAxis) =>
  axis === 'x' ? box.width : box.height

const endAlong = (box: SnapBox, axis: DistributeAxis) =>
  box[axis] + sizeAlong(box, axis)

/** Orders boxes by their start along `axis`, keeping each box's original index. */
export function orderAlong(boxes: SnapBox[], axis: DistributeAxis) {
  return boxes
    .map((box, index) => ({ box, index }))
    .sort((a, b) => a.box[axis] - b.box[axis])
}

/** The shared gap between consecutive ordered boxes, or `undefined` when the gaps differ. */
export function evenGap(
  ordered: SnapBox[],
  axis: DistributeAxis
): number | undefined {
  if (ordered.length < 2) return
  const gaps = ordered
    .slice(1)
    .map((box, i) => box[axis] - endAlong(ordered[i], axis))
  const [first] = gaps
  return gaps.every((gap) => Math.abs(gap - first) <= EQUAL_EPSILON)
    ? first
    : undefined
}

/** Places ordered boxes `gap` apart along `axis`, keeping the anchored end of the row fixed. */
export function spaceEvenly(
  ordered: SnapBox[],
  axis: DistributeAxis,
  gap: number,
  anchor: Anchor = 'start'
): SnapBox[] {
  const first = ordered[0]
  const last = ordered[ordered.length - 1]
  const total =
    ordered.reduce((sum, box) => sum + sizeAlong(box, axis), 0) +
    gap * (ordered.length - 1)
  const origin = {
    start: first[axis],
    end: endAlong(last, axis) - total
  }[anchor]

  let cursor = origin
  return ordered.map((box) => {
    const placed = { ...box, [axis]: cursor }
    cursor += sizeAlong(box, axis) + gap
    return placed
  })
}

function handleAnchor(index: number, gapCount: number): Anchor {
  return index >= (gapCount - 1) / 2 ? 'start' : 'end'
}

/** The gap that keeps the dragged handle under the pointer after it travels `travel` canvas units. */
export function gapAfterTravel(
  ordered: SnapBox[],
  axis: DistributeAxis,
  index: number,
  travel: number
): number {
  const gap = evenGap(ordered, axis) ?? 0
  const gapCount = ordered.length - 1
  const anchor = handleAnchor(index, gapCount)
  const rate = {
    start: 1 / (index + 0.5),
    end: -1 / (gapCount - index - 0.5)
  }[anchor]
  return gap + travel * rate
}

/** Respaces ordered boxes to a whole-unit `gap`, anchored on the side away from handle `index`. */
export function setGap(
  ordered: SnapBox[],
  axis: DistributeAxis,
  index: number,
  gap: number
): SnapBox[] {
  return spaceEvenly(
    ordered,
    axis,
    Math.max(0, Math.round(gap)),
    handleAnchor(index, ordered.length - 1)
  )
}
