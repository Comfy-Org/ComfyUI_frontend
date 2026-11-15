import type { WidgetSizing } from '@comfyorg/graph-model/widgets'
import { distributeSpace } from './spaceDistribution'

export interface RowSpec {
  name: string
  sizing: WidgetSizing
}

export interface NodeBodyBox {
  bodyHeight: number
  startY: number
  rowGap: number
}

interface PlacedRow {
  name: string
  y: number
  height: number
}

export interface NodeBodyLayout {
  rows: readonly PlacedRow[]
  contentHeight: number
  freeSpace: number
}

/** Places widget rows in a body box: fixed rows keep their height, growable rows share the rest. */
export function layoutNodeBody(
  { bodyHeight, startY, rowGap }: NodeBodyBox,
  rows: readonly RowSpec[]
): NodeBodyLayout {
  const fixedHeight = rows.reduce(
    (sum, { sizing }) => sum + (sizing.kind === 'fixed' ? sizing.height : 0),
    0
  )
  const gapHeight = Math.max(0, rows.length - 1) * rowGap
  const freeSpace = bodyHeight - startY - fixedHeight - gapHeight
  const growableRequests = rows.flatMap(({ sizing }) =>
    sizing.kind === 'growable'
      ? [{ minSize: sizing.minHeight, maxSize: sizing.maxHeight }]
      : []
  )
  const allocations = distributeSpace(Math.max(0, freeSpace), growableRequests)

  let y = startY
  let growableIndex = 0
  const placed = rows.map(({ name, sizing }, index) => {
    if (index > 0) y += rowGap
    const height =
      sizing.kind === 'fixed'
        ? sizing.height
        : (allocations[growableIndex++] ?? sizing.minHeight)
    const row = { name, y, height }
    y += height
    return row
  })

  return { rows: placed, contentHeight: y, freeSpace }
}
