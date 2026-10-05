import { describe, expect, it } from 'vitest'

import { distanceScale, globePoint } from './reshoot-globe'

describe('globePoint', () => {
  it.for([
    { name: 'straight on', az: 0, el: 0, x: 0, above: false },
    { name: 'turned right', az: 90, el: 0, x: 100, above: false },
    { name: 'turned left', az: -90, el: 0, x: -100, above: false },
    { name: 'from above', az: 0, el: 45, x: 0, above: true }
  ])('places a camera $name', ({ az, el, x, above }) => {
    const point = globePoint(az, el, 100)
    expect(point.x).toBeCloseTo(x)
    expect(point.y < 0).toBe(above)
  })
})

describe('distanceScale', () => {
  it.for([
    { distance: 0.1, scale: 0.505 },
    { distance: 1, scale: 1 },
    { distance: 3, scale: 1.5 }
  ])(
    'draws distance $distance at $scale radii, as the node does',
    ({ distance, scale }) => {
      expect(distanceScale(distance)).toBeCloseTo(scale)
    }
  )
})
