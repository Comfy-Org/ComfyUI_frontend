import { describe, expect, it } from 'vitest'

import { clampToMinimum, resizeCornerAt, resizeFromCorner } from './groupResize'

const rect = [100, 100, 200, 120] as const

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
  it('keeps the opposite corner fixed', () => {
    expect(resizeFromCorner(rect, 'NW', 10, 20)).toEqual([110, 120, 190, 100])
    expect(resizeFromCorner(rect, 'SE', 10, 20)).toEqual([100, 100, 210, 140])
  })
})

describe('clampToMinimum', () => {
  it('grows toward the dragged corner without moving the fixed edges', () => {
    const clamped = clampToMinimum(
      { x: 250, y: 200, width: 50, height: 20 },
      'NW',
      140,
      80
    )
    expect(clamped).toEqual({ x: 160, y: 140, width: 140, height: 80 })
  })
})
