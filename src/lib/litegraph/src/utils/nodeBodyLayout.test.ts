import { describe, expect, it } from 'vitest'

import type { NodeBodyBox, RowSpec } from './nodeBodyLayout'
import { layoutNodeBody } from './nodeBodyLayout'

const fixed = (name: string, height = 24): RowSpec => ({
  name,
  sizing: { kind: 'fixed', height }
})
const growable = (name: string, minHeight: number, maxHeight?: number) =>
  ({ name, sizing: { kind: 'growable', minHeight, maxHeight } }) as const
const box = (bodyHeight: number, startY = 0, rowGap = 0): NodeBodyBox => ({
  bodyHeight,
  startY,
  rowGap
})

const cases = [
  {
    case: 'fixed rows keep their heights and leave the rest free',
    box: box(100, 10),
    rows: [fixed('a'), fixed('b', 32)],
    heights: [24, 32],
    contentHeight: 66,
    freeSpace: 34
  },
  {
    case: 'one growable row takes everything the fixed rows leave',
    box: box(100),
    rows: [fixed('a'), growable('text', 20), fixed('b')],
    heights: [24, 52, 24],
    contentHeight: 100,
    freeSpace: 52
  },
  {
    case: 'a capped growable row hands its surplus to the uncapped one',
    box: box(100),
    rows: [growable('capped', 10, 30), growable('open', 10)],
    heights: [30, 70],
    contentHeight: 100,
    freeSpace: 100
  },
  {
    case: 'rows keep their minimums when the body is too short',
    box: box(40, 4),
    rows: [fixed('a'), growable('text', 30)],
    heights: [24, 30],
    contentHeight: 58,
    freeSpace: 12
  },
  {
    case: 'row gaps come out of the growable space and count in the content',
    box: box(100, 0, 4),
    rows: [fixed('a'), growable('text', 10), fixed('b')],
    heights: [24, 44, 24],
    contentHeight: 100,
    freeSpace: 44
  },
  {
    case: 'no rows means the content ends where it starts',
    box: box(50, 6),
    rows: [],
    heights: [],
    contentHeight: 6,
    freeSpace: 44
  }
]

describe('layoutNodeBody', () => {
  it.for(cases)('$case', ({ box, rows, heights, contentHeight, freeSpace }) => {
    const layout = layoutNodeBody(box, rows)
    expect(layout.rows.map((row) => row.height)).toEqual(heights)
    expect(layout.contentHeight).toBe(contentHeight)
    expect(layout.freeSpace).toBe(freeSpace)
  })

  it.for(cases)('$case: rows are placed back to back', ({ box, rows }) => {
    const placed = layoutNodeBody(box, rows).rows
    const expectedTops = placed.map((_, index) =>
      index === 0
        ? box.startY
        : placed[index - 1].y + placed[index - 1].height + box.rowGap
    )
    expect(placed.map((row) => row.y)).toEqual(expectedTops)
  })
})
