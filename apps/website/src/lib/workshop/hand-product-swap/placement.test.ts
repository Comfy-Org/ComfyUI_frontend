import { describe, expect, it } from 'vitest'

import { gripRect } from './placement'

const box = { x: 0.4, y: 0.3, w: 0.2, h: 0.4 }

describe('gripRect', () => {
  it('makes the product as wide as the box, centred on it', () => {
    const spot = gripRect(100, 200, box, 1)
    expect(spot.w).toBeCloseTo(0.2)
    expect(spot.h).toBeCloseTo(0.4)
    expect(spot.x).toBeCloseTo(0.4)
    expect(spot.y).toBeCloseTo(0.3)
  })

  it('lets a taller product stand out of the box above and below', () => {
    const spot = gripRect(100, 300, box, 1)
    expect(spot.w).toBeCloseTo(0.2)
    expect(spot.h).toBeCloseTo(0.6)
    expect(spot.y + spot.h / 2).toBeCloseTo(0.5)
  })

  it('shrinks a very slim product so it never towers over the box', () => {
    const spot = gripRect(100, 1000, box, 1)
    expect(spot.h).toBeCloseTo(0.4 * 1.6)
    expect(spot.x + spot.w / 2).toBeCloseTo(0.5)
  })

  it('measures in pixels on a photo that is not square', () => {
    const spot = gripRect(100, 100, { x: 0, y: 0, w: 0.25, h: 0.5 }, 2)
    expect(spot.h).toBeCloseTo(0.5)
  })
})
