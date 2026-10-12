import { describe, expect, it } from 'vitest'

import type { Light } from './lights'
import { newLight } from './lights'
import { SHADOW_STYLES, shadowStyle, withShadowStyle } from './shadows'

const point: Light = { ...newLight('p', 'P', 0), softness: 70 }
const sun: Light = {
  ...newLight('d', 'D', 1, 'directional'),
  softness: 40,
  elevation: 40
}

describe('shadowStyle', () => {
  it.for([
    {
      name: 'no light casts shadows',
      lights: [{ ...point, shadows: false }],
      style: 'none'
    },
    {
      name: 'only a hidden light casts',
      lights: [{ ...point, visible: false }],
      style: 'none'
    },
    { name: 'soft lights on average', lights: [point, sun], style: 'soft' },
    {
      name: 'hard lights on average',
      lights: [{ ...point, softness: 10 }, sun],
      style: 'hard'
    },
    {
      name: 'a low sun',
      lights: [point, { ...sun, elevation: 15 }],
      style: 'long'
    }
  ] as const)('reads $style when $name', ({ lights, style }) => {
    expect(shadowStyle(lights)).toBe(style)
  })
})

describe('withShadowStyle', () => {
  it.for(SHADOW_STYLES)('round-trips the %s look', (style) => {
    expect(shadowStyle(withShadowStyle([point, sun], style))).toBe(style)
  })

  it('lowers only directional lights for a long shadow', () => {
    const [lamp, low] = withShadowStyle([point, sun], 'long')
    expect(lamp.elevation).toBe(point.elevation)
    expect(low.elevation).toBe(12)
  })
})
