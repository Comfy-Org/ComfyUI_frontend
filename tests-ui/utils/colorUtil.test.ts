import { describe, expect, it } from 'vitest'

import { hexToRgb, hsbToRgb, parseToRgb, rgbToHex } from '@/utils/colorUtil'

describe('colorUtil conversions', () => {
  describe('hexToRgb / rgbToHex', () => {
    it('converts 6-digit hex to RGB', () => {
      expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 })
      expect(hexToRgb('#00ff00')).toEqual({ r: 0, g: 255, b: 0 })
      expect(hexToRgb('#0000ff')).toEqual({ r: 0, g: 0, b: 255 })
    })

    it('converts 3-digit hex to RGB', () => {
      expect(hexToRgb('#f00')).toEqual({ r: 255, g: 0, b: 0 })
      expect(hexToRgb('#0f0')).toEqual({ r: 0, g: 255, b: 0 })
      expect(hexToRgb('#00f')).toEqual({ r: 0, g: 0, b: 255 })
    })

    it('converts RGB to lowercase #hex and clamps values', () => {
      expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe('#ff0000')
      expect(rgbToHex({ r: 0, g: 255, b: 0 })).toBe('#00ff00')
      expect(rgbToHex({ r: 0, g: 0, b: 255 })).toBe('#0000ff')
      // out-of-range should clamp
      expect(rgbToHex({ r: -10, g: 300, b: 16 })).toBe('#00ff10')
    })

    it('round-trips #hex -> rgb -> #hex', () => {
      const hex = '#123abc'
      expect(rgbToHex(hexToRgb(hex))).toBe('#123abc')
    })
  })

  describe('parseToRgb', () => {
    it('parses #hex', () => {
      expect(parseToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 })
    })

    it('parses rgb()/rgba()', () => {
      expect(parseToRgb('rgb(255, 0, 0)')).toEqual({ r: 255, g: 0, b: 0 })
      expect(parseToRgb('rgba(255,0,0,0.5)')).toEqual({ r: 255, g: 0, b: 0 })
    })

    it('parses hsl()/hsla()', () => {
      expect(parseToRgb('hsl(0, 100%, 50%)')).toEqual({ r: 255, g: 0, b: 0 })
      const green = parseToRgb('hsla(120, 100%, 50%, 0.7)')
      expect(green.r).toBe(0)
      expect(green.g).toBe(255)
      expect(green.b).toBe(0)
    })
  })

  describe('hsbToRgb', () => {
    it('converts HSB to primary RGB colors', () => {
      expect(hsbToRgb({ h: 0, s: 100, b: 100 })).toEqual({ r: 255, g: 0, b: 0 })
      expect(hsbToRgb({ h: 120, s: 100, b: 100 })).toEqual({
        r: 0,
        g: 255,
        b: 0
      })
      expect(hsbToRgb({ h: 240, s: 100, b: 100 })).toEqual({
        r: 0,
        g: 0,
        b: 255
      })
    })

    it('handles non-100 brightness and clamps/normalizes input', () => {
      const rgb = hsbToRgb({ h: 360, s: 150, b: 50 })
      expect(rgbToHex(rgb)).toBe('#7f0000')
    })
  })
})
