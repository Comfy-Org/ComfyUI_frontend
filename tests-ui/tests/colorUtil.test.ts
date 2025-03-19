import { describe, expect, it, vi } from 'vitest'

import { adjustColor } from '@/utils/colorUtil'

interface ColorTestCase {
  hex: string
  rgb: string
  rgba: string
  hsl: string
  hsla: string
  lightExpected: string
  transparentExpected: string
  lightTransparentExpected: string
}

type ColorFormat = 'hex' | 'rgb' | 'rgba' | 'hsl' | 'hsla'

vi.mock('lodash', () => ({
  memoize: (fn: any) => fn
}))

const targetOpacity = 0.5
const targetLightness = 0.5

const assertColorVariationsMatch = (variations: string[], adjustment: any) => {
  for (let i = 0; i < variations.length - 1; i++) {
    expect(adjustColor(variations[i], adjustment)).toBe(
      adjustColor(variations[i + 1], adjustment)
    )
  }
}

const colors: Record<string, ColorTestCase> = {
  green: {
    hex: '#073642',
    rgb: 'rgb(7, 54, 66)',
    rgba: 'rgba(7, 54, 66, 1)',
    hsl: 'hsl(192, 80.8%, 14.3%)',
    hsla: 'hsla(192, 80.8%, 14.3%, 1)',
    lightExpected: 'hsla(192, 80.8%, 64.3%, 1)',
    transparentExpected: 'hsla(192, 80.8%, 14.3%, 0.5)',
    lightTransparentExpected: 'hsla(192, 80.8%, 64.3%, 0.5)'
  },
  blue: {
    hex: '#00008B',
    rgb: 'rgb(0,0,139)',
    rgba: 'rgba(0,0,139,1)',
    hsl: 'hsl(240,100%,27.3%)',
    hsla: 'hsl(240,100%,27.3%,1)',
    lightExpected: 'hsla(240, 100%, 77.3%, 1)',
    transparentExpected: 'hsla(240, 100%, 27.3%, 0.5)',
    lightTransparentExpected: 'hsla(240, 100%, 77.3%, 0.5)'
  }
}

const formats: ColorFormat[] = ['hex', 'rgb', 'rgba', 'hsl', 'hsla']

describe('colorUtil - adjustColor', () => {
  const runAdjustColorTests = (
    color: ColorTestCase,
    format: ColorFormat
  ): void => {
    it('converts lightness', () => {
      const result = adjustColor(color[format], { lightness: targetLightness })
      expect(result).toBe(color.lightExpected)
    })

    it('applies opacity', () => {
      const result = adjustColor(color[format], { opacity: targetOpacity })
      expect(result).toBe(color.transparentExpected)
    })

    it('applies lightness and opacity jointly', () => {
      const result = adjustColor(color[format], {
        lightness: targetLightness,
        opacity: targetOpacity
      })
      expect(result).toBe(color.lightTransparentExpected)
    })
  }

  describe.each(Object.entries(colors))('%s color', (_colorName, color) => {
    describe.each(formats)('%s format', (format) => {
      runAdjustColorTests(color, format as ColorFormat)
    })
  })

  it('returns the original value for invalid color formats', () => {
    const invalidColors = [
      'cmky(100, 50, 50, 0.5)',
      'rgb(300, -10, 256)',
      'xyz(255, 255, 255)',
      'hsl(100, 50, 50%)',
      'hsl(100, 50%, 50)',
      '#GGGGGG',
      '#3333'
    ]

    invalidColors.forEach((color) => {
      const result = adjustColor(color, {
        lightness: targetLightness,
        opacity: targetOpacity
      })
      expect(result).toBe(color)
    })
  })

  it('returns the original value for null or undefined inputs', () => {
    // @ts-expect-error fixme ts strict error
    expect(adjustColor(null, { opacity: targetOpacity })).toBe(null)
    // @ts-expect-error fixme ts strict error
    expect(adjustColor(undefined, { opacity: targetOpacity })).toBe(undefined)
  })

  describe('handles input variations', () => {
    it('handles spaces in rgb input', () => {
      const variations = [
        'rgb(0, 0, 0)',
        'rgb(0,0,0)',
        'rgb(0, 0,0)',
        'rgb(0,0, 0)'
      ]
      assertColorVariationsMatch(variations, { lightness: 0.5 })
    })

    it('handles spaces in hsl input', () => {
      const variations = [
        'hsl(0, 0%, 0%)',
        'hsl(0,0%,0%)',
        'hsl(0, 0%,0%)',
        'hsl(0,0%, 0%)'
      ]
      assertColorVariationsMatch(variations, { lightness: 0.5 })
    })

    it('handles different decimal places in rgba input', () => {
      const variations = [
        'rgba(0, 0, 0, 0.5)',
        'rgba(0, 0, 0, 0.50)',
        'rgba(0, 0, 0, 0.500)'
      ]
      assertColorVariationsMatch(variations, { opacity: 0.5 })
    })

    it('handles different decimal places in hsla input', () => {
      const variations = [
        'hsla(0, 0%, 0%, 0.5)',
        'hsla(0, 0%, 0%, 0.50)',
        'hsla(0, 0%, 0%, 0.500)'
      ]
      assertColorVariationsMatch(variations, { opacity: 0.5 })
    })
  })

  describe('clamps values correctly', () => {
    it('clamps lightness to 0 and 100', () => {
      expect(adjustColor('hsl(0, 100%, 50%)', { lightness: -1 })).toBe(
        'hsla(0, 100%, 0%, 1)'
      )
      expect(adjustColor('hsl(0, 100%, 50%)', { lightness: 1.5 })).toBe(
        'hsla(0, 100%, 100%, 1)'
      )
    })

    it('clamps opacity to 0 and 1', () => {
      expect(adjustColor('rgba(0, 0, 0, 0.5)', { opacity: -0.5 })).toBe(
        'hsla(0, 0%, 0%, 0)'
      )
      expect(adjustColor('rgba(0, 0, 0, 0.5)', { opacity: 1.5 })).toBe(
        'hsla(0, 0%, 0%, 1)'
      )
    })
  })
})
