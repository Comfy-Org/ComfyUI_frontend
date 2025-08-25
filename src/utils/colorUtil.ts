import { memoize } from 'lodash'

type RGB = { r: number; g: number; b: number }
type HSL = { h: number; s: number; l: number }
type HSLA = { h: number; s: number; l: number; a: number }
type ColorFormat = 'hex' | 'rgb' | 'rgba' | 'hsl' | 'hsla'

export interface ColorAdjustOptions {
  lightness?: number
  opacity?: number
}

function rgbToHsl({ r, g, b }: RGB): HSL {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b)
  let h = 0,
    s = 0
  const l: number = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }
    h /= 6
  }

  return { h, s, l }
}

export function hexToRgb(hex: string): RGB {
  let r = 0,
    g = 0,
    b = 0
  // 3 digits
  if (hex.length == 4) {
    r = parseInt(hex[1] + hex[1], 16)
    g = parseInt(hex[2] + hex[2], 16)
    b = parseInt(hex[3] + hex[3], 16)
  }
  // 6 digits
  else if (hex.length == 7) {
    r = parseInt(hex.slice(1, 3), 16)
    g = parseInt(hex.slice(3, 5), 16)
    b = parseInt(hex.slice(5, 7), 16)
  }
  return { r, g, b }
}

export function parseToRgb(color: string): RGB {
  const format = identifyColorFormat(color)
  if (!format) return { r: 0, g: 0, b: 0 }

  const hsla = parseToHSLA(color, format)
  if (!isHSLA(hsla)) return { r: 0, g: 0, b: 0 }

  // Convert HSL to RGB
  const h = hsla.h / 360
  const s = hsla.s / 100
  const l = hsla.l / 100

  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1))
  const m = l - c / 2

  let r = 0,
    g = 0,
    b = 0

  if (h < 1 / 6) {
    r = c
    g = x
    b = 0
  } else if (h < 2 / 6) {
    r = x
    g = c
    b = 0
  } else if (h < 3 / 6) {
    r = 0
    g = c
    b = x
  } else if (h < 4 / 6) {
    r = 0
    g = x
    b = c
  } else if (h < 5 / 6) {
    r = x
    g = 0
    b = c
  } else {
    r = c
    g = 0
    b = x
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  }
}

const identifyColorFormat = (color: string): ColorFormat | null => {
  if (!color) return null
  if (color.startsWith('#') && (color.length === 4 || color.length === 7))
    return 'hex'
  if (/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*/.test(color))
    return color.includes('rgba') ? 'rgba' : 'rgb'
  if (/hsla?\(\s*\d+(\.\d+)?\s*,\s*\d+(\.\d+)?%\s*,\s*\d+(\.\d+)?%/.test(color))
    return color.includes('hsla') ? 'hsla' : 'hsl'
  return null
}

const isHSLA = (color: unknown): color is HSLA => {
  if (typeof color !== 'object' || color === null) return false

  return ['h', 's', 'l', 'a'].every(
    (key) =>
      typeof (color as Record<string, unknown>)[key] === 'number' &&
      !isNaN((color as Record<string, number>)[key])
  )
}

function parseToHSLA(color: string, format: ColorFormat): HSLA | null {
  let match: RegExpMatchArray | null

  switch (format) {
    case 'hex': {
      const hsl = rgbToHsl(hexToRgb(color))
      return {
        h: Math.round(hsl.h * 360),
        s: +(hsl.s * 100).toFixed(1),
        l: +(hsl.l * 100).toFixed(1),
        a: 1
      }
    }

    case 'rgb':
    case 'rgba': {
      match = color.match(/\d+(\.\d+)?/g)
      if (!match || match.length < 3) return null
      const [r, g, b] = match.map(Number)
      const hsl = rgbToHsl({ r, g, b })

      const a = format === 'rgba' && match[3] ? parseFloat(match[3]) : 1

      return {
        h: Math.round(hsl.h * 360),
        s: +(hsl.s * 100).toFixed(1),
        l: +(hsl.l * 100).toFixed(1),
        a
      }
    }

    case 'hsl':
    case 'hsla': {
      match = color.match(/\d+(\.\d+)?/g)
      if (!match || match.length < 3) return null
      const [h, s, l] = match.map(Number)
      const a = format === 'hsla' && match[3] ? parseFloat(match[3]) : 1
      return { h, s, l, a }
    }
    default:
      return null
  }
}

const applyColorAdjustments = (
  color: string,
  options: ColorAdjustOptions
): string => {
  if (!Object.keys(options).length) return color

  const format = identifyColorFormat(color)
  if (!format) {
    console.warn(`Unsupported color format in color palette: ${color}`)
    return color
  }

  const hsla = parseToHSLA(color, format)
  if (!isHSLA(hsla)) {
    console.warn(`Invalid color values in color palette: ${color}`)
    return color
  }

  if (options.lightness) {
    hsla.l = Math.max(0, Math.min(100, hsla.l + options.lightness * 100.0))
  }

  if (options.opacity) {
    hsla.a = Math.max(0, Math.min(1, options.opacity))
  }

  return `hsla(${hsla.h}, ${hsla.s}%, ${hsla.l}%, ${hsla.a})`
}

export const adjustColor: (
  color: string,
  options: ColorAdjustOptions
) => string = memoize(
  applyColorAdjustments,
  (color: string, options: ColorAdjustOptions): string =>
    `${color}-${JSON.stringify(options)}`
)
