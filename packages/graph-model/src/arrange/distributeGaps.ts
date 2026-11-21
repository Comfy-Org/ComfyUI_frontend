import type { Point2D } from '@comfyorg/shared-frontend-utils/geometry'

import { evenGap, spaceEvenly } from './arrange'
import type { Axis, VisualBox } from './arrange'

type RowEnd = 'start' | 'end'

function fixedEnd(index: number, gapCount: number): RowEnd {
  return index >= (gapCount - 1) / 2 ? 'start' : 'end'
}

/** The gap that keeps the dragged handle under the pointer after it travels `travel` canvas units. */
export function gapAfterTravel(
  ordered: VisualBox[],
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
  ordered: VisualBox[],
  axis: Axis,
  index: number,
  gap: number
): VisualBox[] {
  return spaceEvenly(
    ordered,
    axis,
    Math.max(0, Math.round(gap)),
    fixedEnd(index, ordered.length - 1)
  )
}

/** The centre of each gap between ordered boxes `gap` apart, on the middle of their shared cross extent. */
export function gapMidpoints(
  ordered: VisualBox[],
  axis: Axis,
  gap: number
): Point2D[] {
  const cross = axis === 'x' ? 'y' : 'x'
  const crossSize = axis === 'x' ? 'height' : 'width'
  const crossStart = Math.min(...ordered.map((box) => box[cross]))
  const crossEnd = Math.max(
    ...ordered.map((box) => box[cross] + box[crossSize])
  )
  const middle = (crossStart + crossEnd) / 2
  return ordered.slice(1).map((box) => {
    const along = box[axis] - gap / 2
    return axis === 'x' ? { x: along, y: middle } : { x: middle, y: along }
  })
}
