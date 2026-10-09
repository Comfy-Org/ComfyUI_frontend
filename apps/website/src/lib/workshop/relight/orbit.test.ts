import { describe, expect, it } from 'vitest'

import { fromOrbit } from './orbit'

describe('fromOrbit', () => {
  it.for([
    {
      name: 'from the left shines right',
      around: -90,
      height: 0,
      direction: 0,
      elevation: 0
    },
    {
      name: 'from the right shines left',
      around: 90,
      height: 0,
      direction: 180,
      elevation: 0
    },
    {
      name: 'from above shines down',
      around: 0,
      height: 90,
      direction: 90,
      elevation: 0
    },
    {
      name: 'from below shines up',
      around: 0,
      height: -90,
      direction: -90,
      elevation: 0
    },
    {
      name: 'from the camera faces the photo',
      around: 0,
      height: 0,
      direction: 0,
      elevation: 90
    },
    {
      name: 'from behind faces away',
      around: 180,
      height: 0,
      direction: 0,
      elevation: -90
    }
  ])('$name', ({ around, height, direction, elevation }) => {
    const light = fromOrbit(around, height)
    expect(light.elevation).toBe(elevation)
    if (Math.abs(light.elevation) < 90) expect(light.direction).toBe(direction)
  })
})
