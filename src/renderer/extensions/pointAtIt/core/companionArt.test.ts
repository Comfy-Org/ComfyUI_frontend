import { describe, expect, it } from 'vitest'

import {
  COMPANION_ART,
  COMPANION_FINGERTIPS,
  COMPANION_FRAMES,
  COMPANION_SIZE
} from './companionArt'

describe('her cutouts', () => {
  it.for(COMPANION_FRAMES)('CP-15: the %s frame has an image', (name) => {
    expect(COMPANION_ART[name]).toMatch(/\.webp$/)
  })

  it('CP-06: her fingertips are on the side she points to, level with the line the README gives', () => {
    expect(COMPANION_FINGERTIPS.right.x).toBeGreaterThan(
      COMPANION_SIZE.width / 2
    )
    expect(COMPANION_FINGERTIPS.left.x).toBeLessThan(COMPANION_SIZE.width / 2)
    expect(COMPANION_FINGERTIPS.right.y / COMPANION_SIZE.height).toBeCloseTo(
      0.55
    )
  })
})
