import { describe, expect, it } from 'vitest'

import { hexToHsv, hsvToHex, isHex } from './color-space'

describe('color space', () => {
  it.for([
    ['#ff0000', { h: 0, s: 1, v: 1 }],
    ['#00ff00', { h: 120, s: 1, v: 1 }],
    ['#0000ff', { h: 240, s: 1, v: 1 }],
    ['#000000', { h: 0, s: 0, v: 0 }],
    ['#ffffff', { h: 0, s: 0, v: 1 }]
  ] as const)('reads %s as hue, saturation and value', ([hex, hsv]) => {
    expect(hexToHsv(hex)).toEqual(hsv)
  })

  it.for(['#102030', '#e0a15e', '#7f7f7f', '#3b1b6e'])(
    'returns %s unchanged through a round trip',
    (hex) => {
      expect(hsvToHex(hexToHsv(hex))).toBe(hex)
    }
  )

  it('accepts only six-digit hex colours', () => {
    expect(isHex('#a1b2c3')).toBe(true)
    expect(isHex('#abc')).toBe(false)
    expect(isHex('a1b2c3')).toBe(false)
  })
})
