/** A colour as hue (0-360), saturation and value (0-1), for a picker's square and hue bar. */
export interface Hsv {
  readonly h: number
  readonly s: number
  readonly v: number
}

const HEX = /^#([0-9a-f]{6})$/i

export function isHex(value: string): boolean {
  return HEX.test(value)
}

export function hexToHsv(hex: string): Hsv {
  const [r, g, b] = [1, 3, 5].map(
    (at) => parseInt(hex.slice(at, at + 2), 16) / 255
  )
  const max = Math.max(r, g, b)
  const delta = max - Math.min(r, g, b)
  const sector =
    delta === 0
      ? 0
      : max === r
        ? ((g - b) / delta + 6) % 6
        : max === g
          ? (b - r) / delta + 2
          : (r - g) / delta + 4
  return { h: sector * 60, s: max === 0 ? 0 : delta / max, v: max }
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const channel = (n: number) => {
    const k = (n + h / 60) % 6
    const value = v - v * s * Math.max(0, Math.min(k, 4 - k, 1))
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${channel(5)}${channel(3)}${channel(1)}`
}
