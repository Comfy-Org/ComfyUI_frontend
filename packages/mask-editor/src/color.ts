import { hexToRgb } from '@comfyorg/shared-frontend-utils/colorUtil'

export interface Rgb {
  r: number
  g: number
  b: number
}

const BLACK: Rgb = { r: 0, g: 0, b: 0 }

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
