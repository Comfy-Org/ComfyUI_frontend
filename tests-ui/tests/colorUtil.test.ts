import { applyOpacity } from '@/utils/colorUtil'

describe('colorUtil - applyOpacity', () => {
  // Same color in various formats
  const solarized = {
    hex: '#073642',
    rgb: 'rgb(7, 54, 66)',
    rgba: 'rgba(7, 54, 66, 1)',
    hsl: 'hsl(192, 80.80%, 14.30%)',
    hsla: 'hsla(192, 80.80%, 14.30%, 1)'
  }

  const opacity = 0.5

  it('applies opacity consistently to hex, rgb, and rgba formats', () => {
    const hexResult = applyOpacity(solarized.hex, opacity)
    const rgbResult = applyOpacity(solarized.rgb, opacity)
    const rgbaResult = applyOpacity(solarized.rgba, opacity)

    expect(hexResult).toBe(rgbResult)
    expect(rgbResult).toBe(rgbaResult)
  })

  it('applies opacity consistently to hsl and hsla formats', () => {
    const hslResult = applyOpacity(solarized.hsl, opacity)
    const hslaResult = applyOpacity(solarized.hsla, opacity)

    expect(hslResult).toBe(hslaResult)
  })

  it('returns the original value for invalid color formats', () => {
    const invalidColors = [
      '#GGGGGG', // Invalid hex code (non-hex characters)
      'rgb(300, -10, 256)', // Invalid RGB values (out of range)
      'xyz(255, 255, 255)', // Unsupported format
      'rgba(255, 255, 255)', // Missing alpha in RGBA
      'hsl(100, 50, 50%)' // Missing percentage sign for saturation
    ]

    invalidColors.forEach((color) => {
      const result = applyOpacity(color, opacity)
      expect(result).toBe(color)
    })
  })

  it('returns the original value for null or undefined inputs', () => {
    expect(applyOpacity(null, opacity)).toBe(null)
    expect(applyOpacity(undefined, opacity)).toBe(undefined)
  })
})
