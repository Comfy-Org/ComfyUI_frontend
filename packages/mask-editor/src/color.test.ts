import { describe, expect, it } from 'vitest'

import type { Rgb } from './color'
import { parseToRgb, rgbToHsl } from './color'

describe('parseToRgb', () => {
  it.for<[string, Rgb]>([
    ['#1a2b3c', { r: 26, g: 43, b: 60 }],
    ['#1a2b3cff', { r: 26, g: 43, b: 60 }],
    ['#f80', { r: 255, g: 136, b: 0 }],
    ['#f808', { r: 255, g: 136, b: 0 }],
    ['rgb(7, 128, 250)', { r: 7, g: 128, b: 250 }],
    ['rgba(7,128,250,0.5)', { r: 7, g: 128, b: 250 }],
    ['not a colour', { r: 0, g: 0, b: 0 }],
    ['#12345', { r: 0, g: 0, b: 0 }]
  ])('parses %s', ([input, expected]) => {
    expect(parseToRgb(input)).toEqual(expected)
  })
})

describe('rgbToHsl', () => {
  it.for<[Rgb, ReturnType<typeof rgbToHsl>]>([
    [
      { r: 255, g: 0, b: 0 },
      { h: 0, s: 1, l: 0.5 }
    ],
    [
      { r: 0, g: 255, b: 0 },
      { h: 1 / 3, s: 1, l: 0.5 }
    ],
    [
      { r: 0, g: 0, b: 255 },
      { h: 2 / 3, s: 1, l: 0.5 }
    ],
    [
      { r: 255, g: 0, b: 128 },
      { h: 0.9163, s: 1, l: 0.5 }
    ],
    [
      { r: 51, g: 51, b: 51 },
      { h: 0, s: 0, l: 0.2 }
    ]
  ])('converts %o', ([rgb, expected]) => {
    const hsl = rgbToHsl(rgb)
    expect(hsl.h).toBeCloseTo(expected.h, 3)
    expect(hsl.s).toBeCloseTo(expected.s, 3)
    expect(hsl.l).toBeCloseTo(expected.l, 3)
  })
})
