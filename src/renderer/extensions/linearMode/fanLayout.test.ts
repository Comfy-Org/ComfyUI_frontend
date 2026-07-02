import { describe, expect, it } from 'vitest'

import { computeFanLayout } from '@/renderer/extensions/linearMode/fanLayout'

describe('computeFanLayout', () => {
  it('places the newest card (depth 0) dead centre, frontmost and largest', () => {
    const newest = computeFanLayout(0, 3)

    expect(newest.x).toBe(0)
    expect(newest.rotate).toBe(0)
    expect(newest.scale).toBe(1)
    expect(newest.opacity).toBe(1)
    // Highest z of the fan so it paints on top.
    expect(newest.z).toBe(3)
  })

  it('fans older cards out to alternating sides, scaled and faded back', () => {
    const cards = [0, 1, 2].map((depth) => computeFanLayout(depth, 3))
    const [newest, mid, oldest] = cards

    // Older cards sit off-centre on alternating sides.
    expect(newest.x).toBe(0)
    expect(mid.x).toBeGreaterThan(0)
    expect(oldest.x).toBeLessThan(0)
    expect(Math.sign(mid.x)).not.toBe(Math.sign(oldest.x))

    // Depth recedes: smaller, more transparent, lower z.
    expect(mid.scale).toBeLessThan(newest.scale)
    expect(oldest.scale).toBeLessThan(mid.scale)
    expect(mid.opacity).toBeLessThan(newest.opacity)
    expect(oldest.z).toBeLessThan(mid.z)
  })

  it('clamps scale and opacity so deep cards never vanish', () => {
    const deep = computeFanLayout(20, 21)

    expect(deep.scale).toBe(0.7)
    expect(deep.opacity).toBe(0.3)
  })
})
