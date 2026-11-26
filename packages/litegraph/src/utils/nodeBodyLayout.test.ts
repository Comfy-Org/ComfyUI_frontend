import { describe, expect, it } from 'vitest'

import type { WidgetSizing } from '@comfyorg/graph-model/widgets'

import { layoutNodeBody } from './nodeBodyLayout'

const fixed = (height = 24): WidgetSizing => ({ kind: 'fixed', height })
const growable = (minHeight: number, maxHeight?: number): WidgetSizing => ({
  kind: 'growable',
  minHeight,
  maxHeight,
  minWidth: 0
})

describe('layoutNodeBody', () => {
  it.for([
    {
      case: 'fixed rows keep their heights and leave the rest free',
      bodyHeight: 100,
      startY: 10,
      rows: [fixed(), fixed(32)],
      tops: [10, 34],
      heights: [24, 32],
      contentHeight: 66,
      freeSpace: 34
    },
    {
      case: 'one growable row takes everything the fixed rows leave',
      bodyHeight: 100,
      startY: 0,
      rows: [fixed(), growable(20), fixed()],
      tops: [0, 24, 76],
      heights: [24, 52, 24],
      contentHeight: 100,
      freeSpace: 52
    },
    {
      case: 'a capped growable row hands its surplus to the uncapped one',
      bodyHeight: 100,
      startY: 0,
      rows: [growable(10, 30), growable(10)],
      tops: [0, 30],
      heights: [30, 70],
      contentHeight: 100,
      freeSpace: 100
    },
    {
      case: 'rows keep their minimums when the body is too short',
      bodyHeight: 40,
      startY: 4,
      rows: [fixed(), growable(30)],
      tops: [4, 28],
      heights: [24, 30],
      contentHeight: 58,
      freeSpace: 12
    },
    {
      case: 'no rows means the content ends where it starts',
      bodyHeight: 50,
      startY: 6,
      rows: [],
      tops: [],
      heights: [],
      contentHeight: 6,
      freeSpace: 44
    }
  ])(
    '$case',
    ({ bodyHeight, startY, rows, tops, heights, contentHeight, freeSpace }) => {
      const layout = layoutNodeBody(bodyHeight, startY, rows)
      expect(layout.rows).toEqual(
        tops.map((y, index) => ({ y, height: heights[index] }))
      )
      expect(layout.contentHeight).toBe(contentHeight)
      expect(layout.freeSpace).toBe(freeSpace)
    }
  )
})
