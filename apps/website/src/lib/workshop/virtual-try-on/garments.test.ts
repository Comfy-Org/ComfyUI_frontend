import { describe, expect, it } from 'vitest'

import type { Point } from './garments'
import { fittedOutline, outlinePath } from './garments'

const square: Point[] = [
  { x: 0.4, y: 0.2 },
  { x: 0.6, y: 0.2 },
  { x: 0.6, y: 0.6 },
  { x: 0.4, y: 0.6 }
]

const width = (points: readonly Point[]) =>
  Math.max(...points.map(({ x }) => x)) - Math.min(...points.map(({ x }) => x))
const hem = (points: readonly Point[]) => Math.max(...points.map(({ y }) => y))

describe('fittedOutline', () => {
  it('follows the body for Slim and grows wider and longer towards Relaxed', () => {
    const [slim, regular, relaxed] = (
      ['slim', 'regular', 'relaxed'] as const
    ).map((fit) => fittedOutline(square, fit))
    expect(slim).toEqual(square)
    expect(width(regular)).toBeGreaterThan(width(slim))
    expect(width(relaxed)).toBeGreaterThan(width(regular))
    expect(hem(relaxed)).toBeGreaterThan(hem(regular))
  })

  it('keeps the collar where it was and the outline on the photo', () => {
    const wide = fittedOutline(
      [
        { x: 0, y: 0.1 },
        { x: 1, y: 0.1 },
        { x: 1, y: 0.98 }
      ],
      'relaxed'
    )
    expect(Math.min(...wide.map(({ y }) => y))).toBe(0.1)
    for (const { x, y } of wide) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(1)
      expect(y).toBeLessThanOrEqual(1)
    }
  })
})

describe('outlinePath', () => {
  it('draws a closed curve through the edge midpoints, at the given size', () => {
    expect(outlinePath(square, 100, 200)).toBe(
      'M50 40Q60 40 60 80Q60 120 50 120Q40 120 40 80Q40 40 50 40Z'
    )
  })

  it('draws nothing for fewer than three points', () => {
    expect(outlinePath(square.slice(0, 2), 100, 100)).toBe('')
  })
})
