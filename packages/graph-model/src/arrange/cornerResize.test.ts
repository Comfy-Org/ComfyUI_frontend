import { describe, expect, it } from 'vitest'

import type { CompassCorners } from '@comfyorg/shared-frontend-utils/geometry'

import {
  clampToMinimum,
  resizeBox,
  resizeCornerAt,
  resizeFromCorner
} from './cornerResize'

const rect = [100, 100, 200, 120] as const
const start = { x: 103, y: 41, width: 200, height: 120 }

describe('resizeCornerAt', () => {
  it.for([
    { x: 102, y: 102, corner: 'NW' },
    { x: 298, y: 102, corner: 'NE' },
    { x: 102, y: 218, corner: 'SW' },
    { x: 298, y: 218, corner: 'SE' },
    { x: 200, y: 160, corner: undefined },
    { x: 200, y: 102, corner: undefined },
    { x: 50, y: 50, corner: undefined }
  ])('($x, $y) → $corner', ({ x, y, corner }) => {
    expect(resizeCornerAt(rect, x, y)).toBe(corner)
  })
})

describe('resizeFromCorner', () => {
  it.for<{ corner: CompassCorners; expected: number[] }>([
    { corner: 'NW', expected: [113, 61, 190, 100] },
    { corner: 'NE', expected: [103, 61, 210, 100] },
    { corner: 'SW', expected: [113, 41, 190, 140] },
    { corner: 'SE', expected: [103, 41, 210, 140] }
  ])(
    'dragging $corner keeps the opposite corner fixed',
    ({ corner, expected }) => {
      const { x, y, width, height } = resizeFromCorner(start, corner, 10, 20)
      expect([x, y, width, height]).toEqual(expected)
    }
  )

  it.for<{ corner: CompassCorners; expected: number[] }>([
    { corner: 'NW', expected: [100, 50, 203, 111] },
    { corner: 'NE', expected: [103, 50, 200, 111] },
    { corner: 'SW', expected: [100, 41, 203, 150] },
    { corner: 'SE', expected: [103, 41, 200, 150] }
  ])(
    'with a grid, dragging $corner snaps its dragged edges and keeps the opposite edges fixed',
    ({ corner, expected }) => {
      const { x, y, width, height } = resizeFromCorner(start, corner, 4, 6, 50)
      expect([x, y, width, height]).toEqual(expected)
    }
  )

  it('rounds the size up on the grid when asked to ceil', () => {
    const { x, y, width, height } = resizeFromCorner(
      start,
      'SE',
      4,
      6,
      50,
      'ceil'
    )
    expect([x, y, width, height]).toEqual([103, 41, 250, 150])
  })
})

describe('clampToMinimum', () => {
  it.for<{ corner: CompassCorners; expected: number[] }>([
    { corner: 'NW', expected: [160, 140, 140, 80] },
    { corner: 'SE', expected: [250, 200, 140, 80] }
  ])(
    'growing from $corner keeps the opposite edges',
    ({ corner, expected }) => {
      const { x, y, width, height } = clampToMinimum(
        { x: 250, y: 200, width: 50, height: 20 },
        corner,
        140,
        80
      )
      expect([x, y, width, height]).toEqual(expected)
    }
  )
})

describe('resizeBox', () => {
  const min = { width: 140, height: 80 }

  it('lets the snap adjust the box, then grows it back to the minimum from the dragged corner', () => {
    const { x, y, width, height } = resizeBox(
      start,
      'NW',
      { x: 150, y: 0 },
      {
        minAt: () => min,
        snap: (box) => ({ ...box, y: box.y + 90, height: 30 })
      }
    )
    expect([x, y, width, height]).toEqual([163, 81, 140, 80])
  })

  it('re-measures the minimum when the snap changes the width', () => {
    const widths: number[] = []
    resizeBox(
      start,
      'SE',
      { x: 10, y: 0 },
      {
        minAt: (width) => {
          widths.push(width)
          return min
        },
        snap: (box) => ({ ...box, width: 250 })
      }
    )
    expect(widths).toEqual([210, 250])
  })
})
