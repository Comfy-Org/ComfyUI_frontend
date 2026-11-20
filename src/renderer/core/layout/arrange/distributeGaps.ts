import { evenGap, spaceEvenly } from '@/renderer/core/layout/arrange/arrange'
import type { Axis, VisualBox } from '@/renderer/core/layout/arrange/arrange'

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
