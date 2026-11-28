import { describe, expect, it } from 'vitest'

import { anchorAt, scrollTopFor } from './virtualGridAnchor'

describe('virtualGridAnchor', () => {
  const grid = {
    scrollTop: 250,
    rowTop: 0,
    rowPitch: 100,
    cols: 4,
    trackLeft: 0,
    stride: 100
  }

  it('finds the item under the focus point and its offset into the row', () => {
    const anchor = anchorAt({ x: 130, y: 80 }, grid)
    expect(anchor.index).toBe(13)
    expect(anchor.rowFraction).toBeCloseTo(0.3)
  })

  it('keeps the anchored item under the focus point after the grid reflows', () => {
    const anchor = anchorAt({ x: 130, y: 80 }, grid)
    expect(scrollTopFor(anchor, 3, { rowTop: 0, rowPitch: 140 })).toBeCloseTo(
      522
    )
  })

  it('clamps a focus point past the last column to that column', () => {
    expect(anchorAt({ x: 420, y: 0 }, { ...grid, scrollTop: 0 }).index).toBe(3)
  })

  it('measures columns from the first track and the track-plus-gap stride', () => {
    const centered = {
      scrollTop: 0,
      rowTop: 0,
      rowPitch: 100,
      cols: 3,
      trackLeft: 52,
      stride: 168
    }
    expect(anchorAt({ x: 205, y: 0 }, centered).index).toBe(0)
    expect(anchorAt({ x: 225, y: 0 }, centered).index).toBe(1)
    expect(anchorAt({ x: 10, y: 0 }, centered).index).toBe(0)
  })

  it('counts the top padding and row gap in each row', () => {
    const padded = { rowTop: 16, rowPitch: 136 }
    const anchor = anchorAt(
      { x: 0, y: 0 },
      { ...padded, scrollTop: 1376, cols: 4, trackLeft: 0, stride: 100 }
    )
    expect(anchor.index).toBe(40)
    expect(scrollTopFor(anchor, 2, padded)).toBe(2736)
  })

  it('anchors a focus point in the top padding to the first row', () => {
    const anchor = anchorAt(
      { x: 0, y: 8 },
      { ...grid, scrollTop: 0, rowTop: 16 }
    )
    expect(anchor).toEqual({ index: 0, rowFraction: 0, focusY: 8 })
  })

  it('never scrolls above the top', () => {
    const anchor = anchorAt({ x: 0, y: 90 }, { ...grid, scrollTop: 0 })
    expect(scrollTopFor(anchor, 2, { rowTop: 0, rowPitch: 50 })).toBe(0)
  })
})
