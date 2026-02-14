export type ColorStop = readonly [
  offset: number,
  r: number,
  g: number,
  b: number
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
