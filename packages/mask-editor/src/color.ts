export interface Rgb {
  r: number
  g: number
  b: number
}

const BLACK: Rgb = { r: 0, g: 0, b: 0 }

/** Parses `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa`; alpha is ignored. */
export function hexToRgb(hex: string): Rgb {
  if (hex.length === 4 || hex.length === 5) {
    return {
      r: parseInt(hex[1] + hex[1], 16),
      g: parseInt(hex[2] + hex[2], 16),
      b: parseInt(hex[3] + hex[3], 16)
    }
  }
  if (hex.length === 7 || hex.length === 9) {
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16)
    }
  }
  return BLACK
}

/** Parses a hex, `rgb()` or `rgba()` colour; anything else is black. */
export function parseToRgb(color: string): Rgb {
  if (color.startsWith('#')) return hexToRgb(color)
  const channels = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(color)
  if (!channels) return BLACK
  return {
    r: Number(channels[1]),
    g: Number(channels[2]),
    b: Number(channels[3])
  }
}

/** Converts 0–255 channels to hue, saturation and lightness in 0–1. */
export function rgbToHsl({ r, g, b }: Rgb): {
  h: number
  s: number
  l: number
} {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const sector =
    max === rn
      ? (gn - bn) / d + (gn < bn ? 6 : 0)
      : max === gn
        ? (bn - rn) / d + 2
        : (rn - gn) / d + 4
  return { h: sector / 6, s, l }
}
