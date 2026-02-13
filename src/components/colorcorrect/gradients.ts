export type ColorStop = readonly [
  offset: number,
  r: number,
  g: number,
  b: number
]

export const HUE_STOPS: ColorStop[] = [
  [0, 255, 0, 0],
  [1 / 6, 255, 255, 0],
  [2 / 6, 0, 255, 0],
  [3 / 6, 0, 255, 255],
  [4 / 6, 0, 0, 255],
  [5 / 6, 255, 0, 255],
  [1, 255, 0, 0]
]

export const SATURATION_STOPS: ColorStop[] = [
  [0, 128, 128, 128],
  [1, 255, 0, 0]
]

export const BRIGHTNESS_STOPS: ColorStop[] = [
  [0, 0, 0, 0],
  [1, 255, 255, 255]
]

export const TEMPERATURE_STOPS: ColorStop[] = [
  [0, 68, 136, 255],
  [0.5, 255, 255, 255],
  [1, 255, 136, 0]
]

export const CONTRAST_STOPS: ColorStop[] = [
  [0, 136, 136, 136],
  [0.4, 68, 68, 68],
  [0.6, 187, 187, 187],
  [0.8, 0, 0, 0],
  [1, 255, 255, 255]
]

export const GAMMA_STOPS: ColorStop[] = [
  [0, 34, 34, 34],
  [0.3, 85, 85, 85],
  [0.5, 153, 153, 153],
  [0.7, 204, 204, 204],
  [1, 255, 255, 255]
]

export function stopsToGradient(stops: ColorStop[]): string {
  const colors = stops.map(
    ([offset, r, g, b]) => `rgb(${r},${g},${b}) ${offset * 100}%`
  )
  return `linear-gradient(to right, ${colors.join(', ')})`
}

export function interpolateStops(stops: ColorStop[], t: number): string {
  const clamped = Math.max(0, Math.min(1, t))

  if (clamped <= stops[0][0]) {
    const [, r, g, b] = stops[0]
    return `rgb(${r},${g},${b})`
  }

  for (let i = 0; i < stops.length - 1; i++) {
    const [o1, r1, g1, b1] = stops[i]
    const [o2, r2, g2, b2] = stops[i + 1]
    if (clamped >= o1 && clamped <= o2) {
      const f = o2 === o1 ? 0 : (clamped - o1) / (o2 - o1)
      const r = Math.round(r1 + (r2 - r1) * f)
      const g = Math.round(g1 + (g2 - g1) * f)
      const b = Math.round(b1 + (b2 - b1) * f)
      return `rgb(${r},${g},${b})`
    }
  }

  const [, r, g, b] = stops[stops.length - 1]
  return `rgb(${r},${g},${b})`
}
