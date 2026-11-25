import type { WidgetSizing } from '@comfyorg/graph-model/widgets'
import { distributeSpace } from './spaceDistribution'

interface PlacedRow {
  y: number
  height: number
}

export interface NodeBodyLayout {
  rows: readonly PlacedRow[]
  contentHeight: number
  freeSpace: number
}

/** Places widget rows from `startY` in a body `bodyHeight` tall: fixed rows keep their height, growable rows share the rest. */
export function layoutNodeBody(
  bodyHeight: number,
  startY: number,
  rows: readonly WidgetSizing[]
): NodeBodyLayout {
  const fixedHeight = rows.reduce(
    (sum, sizing) => sum + (sizing.kind === 'fixed' ? sizing.height : 0),
    0
  )
  const freeSpace = bodyHeight - startY - fixedHeight
  const growableRequests = rows.flatMap((sizing) =>
    sizing.kind === 'growable'
      ? [{ minSize: sizing.minHeight, maxSize: sizing.maxHeight }]
      : []
  )
  const allocations = distributeSpace(Math.max(0, freeSpace), growableRequests)

  let y = startY
  let growableIndex = 0
  const placed = rows.map((sizing) => {
    const height =
      sizing.kind === 'fixed'
        ? sizing.height
        : (allocations[growableIndex++] ?? sizing.minHeight)
    const row = { y, height }
    y += height
    return row
  })

  return { rows: placed, contentHeight: y, freeSpace }
}
