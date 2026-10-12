import { describe, expect, it } from 'vitest'

import { MIN_SIZE, isMoved, moveRect, rectBetween, resizeRect } from './arrange'

const box = { x: 0.2, y: 0.2, w: 0.3, h: 0.4 }

describe('moveRect', () => {
  it.for([
    {
      name: 'moves freely inside the image',
      dx: 0.1,
      dy: -0.1,
      x: 0.3,
      y: 0.1
    },
    { name: 'stops at the left and top edges', dx: -1, dy: -1, x: 0, y: 0 },
    {
      name: 'stops at the right and bottom edges',
      dx: 1,
      dy: 1,
      x: 0.7,
      y: 0.6
    }
  ])('$name', ({ dx, dy, x, y }) => {
    const moved = moveRect(box, dx, dy)
    expect(moved.x).toBeCloseTo(x)
    expect(moved.y).toBeCloseTo(y)
    expect([moved.w, moved.h]).toEqual([box.w, box.h])
  })
})

describe('resizeRect', () => {
  it('keeps the opposite corner in place', () => {
    const grown = resizeRect(box, 'nw', -0.1, -0.1)
    expect(grown.x + grown.w).toBeCloseTo(box.x + box.w)
    expect(grown.y + grown.h).toBeCloseTo(box.y + box.h)
    expect(grown.w).toBeCloseTo(0.4)
  })

  it('never shrinks a box below the smallest size', () => {
    const squashed = resizeRect(box, 'se', -1, -1)
    expect(squashed.w).toBeCloseTo(MIN_SIZE)
    expect(squashed.h).toBeCloseTo(MIN_SIZE)
  })
})

describe('rectBetween', () => {
  it('spans two points in any order and stays inside the image', () => {
    const drawn = rectBetween({ x: 0.9, y: 1.2 }, { x: 0.5, y: 0.4 })
    expect(drawn.x).toBeCloseTo(0.5)
    expect(drawn.y).toBeCloseTo(0.4)
    expect(drawn.w).toBeCloseTo(0.4)
    expect(drawn.h).toBeCloseTo(0.6)
  })
})

describe('isMoved', () => {
  it('tells a moved object from one left in place', () => {
    expect(isMoved({ id: 'a', label: 'A', from: box, to: box })).toBe(false)
    expect(
      isMoved({ id: 'a', label: 'A', from: box, to: moveRect(box, 0.05, 0) })
    ).toBe(true)
  })
})
