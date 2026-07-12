import { describe, expect, it } from 'vitest'

import type { BoundingBox } from '@/types/boundingBoxes'

import type { HitMode, Region } from './boundingBoxesUtil'
import {
  applyDrag,
  boxesAt,
  fromBoundingBoxes,
  tagRects,
  toBoundingBoxes
} from './boundingBoxesUtil'

const region = (over: Partial<Region> = {}): Region => ({
  x: 0.2,
  y: 0.2,
  w: 0.2,
  h: 0.2,
  type: 'obj',
  text: '',
  desc: '',
  palette: [],
  ...over
})

describe('applyDrag', () => {
  it('moves without resizing and keeps width/height', () => {
    const out = applyDrag('move', region({ x: 0.2, y: 0.2 }), 0.1, 0.1)
    expect(out.x).toBeCloseTo(0.3)
    expect(out.y).toBeCloseTo(0.3)
    expect(out.w).toBeCloseTo(0.2)
    expect(out.h).toBeCloseTo(0.2)
  })

  it('clamps a move so the box stays inside the unit square', () => {
    const out = applyDrag(
      'move',
      region({ x: 0.9, y: 0.9, w: 0.2, h: 0.2 }),
      0.5,
      0.5
    )
    expect(out.x).toBeCloseTo(0.8)
    expect(out.y).toBeCloseTo(0.8)
  })

  it('grows from the bottom-right for draw and resize-br', () => {
    for (const mode of ['draw', 'resize-br'] as HitMode[]) {
      const out = applyDrag(
        mode,
        region({ x: 0.2, y: 0.2, w: 0.1, h: 0.1 }),
        0.1,
        0.2
      )
      expect(out).toMatchObject({ x: 0.2, y: 0.2 })
      expect(out.w).toBeCloseTo(0.2)
      expect(out.h).toBeCloseTo(0.3)
    }
  })

  it('moves the top-left corner on resize-tl', () => {
    const out = applyDrag(
      'resize-tl',
      region({ x: 0.5, y: 0.5, w: 0.2, h: 0.2 }),
      0.1,
      0.1
    )
    expect(out.x).toBeCloseTo(0.6)
    expect(out.y).toBeCloseTo(0.6)
    expect(out.w).toBeCloseTo(0.1)
    expect(out.h).toBeCloseTo(0.1)
  })

  it('normalizes a corner drag that inverts the box', () => {
    const out = applyDrag(
      'resize-tl',
      region({ x: 0.5, y: 0.5, w: 0.2, h: 0.2 }),
      0.3,
      0
    )
    expect(out.x).toBeCloseTo(0.7)
    expect(out.w).toBeCloseTo(0.1)
    expect(out.y).toBeCloseTo(0.5)
    expect(out.h).toBeCloseTo(0.2)
  })

  it('resizes single edges', () => {
    expect(applyDrag('resize-r', region({ w: 0.2 }), 0.1, 0).w).toBeCloseTo(0.3)
    expect(applyDrag('resize-b', region({ h: 0.2 }), 0, 0.1).h).toBeCloseTo(0.3)
    const top = applyDrag('resize-t', region({ y: 0.4, h: 0.2 }), 0, 0.1)
    expect(top.y).toBeCloseTo(0.5)
    expect(top.h).toBeCloseTo(0.1)
    const left = applyDrag('resize-l', region({ x: 0.4, w: 0.2 }), 0.1, 0)
    expect(left.x).toBeCloseTo(0.5)
    expect(left.w).toBeCloseTo(0.1)
  })
})

describe('boxesAt', () => {
  const regions: Region[] = [region({ x: 0.2, y: 0.2, w: 0.2, h: 0.2 })]

  it('detects a corner handle', () => {
    const hits = boxesAt(regions, 0.2, 0.2, 6, 100, 100, -1)
    expect(hits[0]).toEqual({ index: 0, mode: 'resize-tl' })
  })

  it('detects an interior move', () => {
    const hits = boxesAt(regions, 0.3, 0.3, 6, 100, 100, -1)
    expect(hits[0]).toEqual({ index: 0, mode: 'move' })
  })

  it('returns nothing when the pointer misses every box', () => {
    expect(boxesAt(regions, 0.9, 0.9, 6, 100, 100, -1)).toEqual([])
  })

  it('brings the active box to the front of overlapping candidates', () => {
    const overlapping: Region[] = [
      region({ x: 0.2, y: 0.2, w: 0.2, h: 0.2 }),
      region({ x: 0.25, y: 0.25, w: 0.2, h: 0.2 })
    ]
    const hits = boxesAt(overlapping, 0.3, 0.3, 6, 100, 100, 1)
    expect(hits).toHaveLength(2)
    expect(hits[0].index).toBe(1)
  })
})

describe('tagRects', () => {
  const measure = (s: string) => s.length * 7

  it('places the first tag at the top-left corner', () => {
    const rects = tagRects(
      [region({ x: 0.1, y: 0.1, w: 0.3, h: 0.3 })],
      100,
      100,
      measure
    )
    expect(rects[0]).toMatchObject({ x: 10, y: 10, tag: '01' })
    expect(rects[0].w).toBe(measure('01') + 8)
  })

  it('moves a colliding tag to a different corner', () => {
    const boxes = [
      region({ x: 0.1, y: 0.1, w: 0.3, h: 0.3 }),
      region({ x: 0.1, y: 0.1, w: 0.3, h: 0.3 })
    ]
    const rects = tagRects(boxes, 100, 100, measure)
    const sameSpot = rects[1].x === rects[0].x && rects[1].y === rects[0].y
    expect(sameSpot).toBe(false)
  })
})

describe('fromBoundingBoxes', () => {
  it('converts pixel boxes to normalized regions with metadata', () => {
    const boxes: BoundingBox[] = [
      {
        x: 100,
        y: 200,
        width: 300,
        height: 400,
        metadata: { type: 'text', text: 'hi', desc: 'd', palette: ['#ffffff'] }
      }
    ]
    expect(fromBoundingBoxes(boxes, 1000, 1000)[0]).toEqual({
      x: 0.1,
      y: 0.2,
      w: 0.3,
      h: 0.4,
      type: 'text',
      text: 'hi',
      desc: 'd',
      palette: ['#ffffff']
    })
  })

  it('normalizes palette entries and drops invalid colors', () => {
    const boxes: BoundingBox[] = [
      {
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        metadata: {
          type: 'obj',
          text: '',
          desc: '',
          palette: ['#FF0000', '#abc', 'red', '', 123] as unknown as string[]
        }
      }
    ]
    expect(fromBoundingBoxes(boxes, 100, 100)[0].palette).toEqual([
      '#ff0000',
      '#aabbcc'
    ])
  })

  it('fills defaults when metadata is missing or partial', () => {
    const boxes = [{ x: 0, y: 0, width: 10, height: 10 }] as BoundingBox[]
    expect(fromBoundingBoxes(boxes, 100, 100)[0]).toMatchObject({
      type: 'obj',
      text: '',
      desc: '',
      palette: []
    })
  })

  it('drops entries that are not bounding boxes', () => {
    const boxes = [null, { x: 1 }, undefined] as unknown as BoundingBox[]
    expect(fromBoundingBoxes(boxes, 100, 100)).toEqual([])
  })

  it('guards against zero dimensions', () => {
    const boxes: BoundingBox[] = [
      {
        x: 5,
        y: 5,
        width: 5,
        height: 5,
        metadata: { type: 'obj', text: '', desc: '', palette: [] }
      }
    ]
    expect(fromBoundingBoxes(boxes, 0, 0)[0]).toMatchObject({
      x: 5,
      y: 5,
      w: 5,
      h: 5
    })
  })
})

describe('toBoundingBoxes', () => {
  it('rounds normalized regions back to pixels and copies the palette', () => {
    const palette = ['#abc']
    const regions: Region[] = [
      region({ x: 0.1, y: 0.2, w: 0.3, h: 0.4, palette })
    ]
    const [box] = toBoundingBoxes(regions, 1000, 1000)
    expect(box).toMatchObject({ x: 100, y: 200, width: 300, height: 400 })
    expect(box.metadata.palette).toEqual(['#abc'])
    expect(box.metadata.palette).not.toBe(palette)
  })

  it('round-trips from pixels to regions and back', () => {
    const boxes: BoundingBox[] = [
      {
        x: 100,
        y: 200,
        width: 300,
        height: 400,
        metadata: { type: 'obj', text: '', desc: '', palette: [] }
      }
    ]
    const restored = toBoundingBoxes(
      fromBoundingBoxes(boxes, 1000, 1000),
      1000,
      1000
    )
    expect(restored).toEqual(boxes)
  })
})
