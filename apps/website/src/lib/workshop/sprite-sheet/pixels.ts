/** RGBA pixels, four bytes each, row by row. */
export interface Pixels {
  readonly data: Uint8ClampedArray
  readonly width: number
  readonly height: number
}

export interface Bounds {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

type Rgb = readonly [number, number, number]

const SOLID = 128

/** A channel value snapped to one of `levels` evenly spaced steps. */
export function posterize(value: number, levels: number): number {
  const steps = Math.max(1, levels - 1)
  return Math.round((Math.round((value / 255) * steps) * 255) / steps)
}

/**
 * The box around the pixels at least half opaque, or the whole image when
 * none are (a photo with no transparency is all character).
 */
export function opaqueBounds({ data, width, height }: Pixels): Bounds {
  let left = width
  let top = height
  let right = -1
  let bottom = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < SOLID) continue
      left = Math.min(left, x)
      right = Math.max(right, x)
      top = Math.min(top, y)
      bottom = Math.max(bottom, y)
    }
  }
  if (right < 0) return { x: 0, y: 0, width, height }
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 }
}

/** Every pixel fully opaque or fully clear, as sprites are. */
function hardened(data: Uint8ClampedArray): Uint8ClampedArray {
  const next = new Uint8ClampedArray(data)
  for (let at = 3; at < next.length; at += 4)
    next[at] = next[at] >= SOLID ? 255 : 0
  return next
}

/** Pixel art: hard edges and a small palette of `levels` steps a channel. */
export function pixelArt(pixels: Pixels, levels = 5): Pixels {
  const data = hardened(pixels.data)
  for (let at = 0; at < data.length; at += 4) {
    data[at] = posterize(data[at], levels)
    data[at + 1] = posterize(data[at + 1], levels)
    data[at + 2] = posterize(data[at + 2], levels)
  }
  return { ...pixels, data }
}

const TOON_BANDS = [
  { below: 0.32, tone: 0.68 },
  { below: 0.72, tone: 1 },
  { below: Infinity, tone: 1.14 }
] as const

/** Cel shading: hard edges and each colour flattened to three tones. */
export function toonShade(pixels: Pixels): Pixels {
  const data = hardened(pixels.data)
  for (let at = 0; at < data.length; at += 4) {
    const light =
      (0.299 * data[at] + 0.587 * data[at + 1] + 0.114 * data[at + 2]) / 255
    const tone = TOON_BANDS.find((band) => light < band.below)?.tone ?? 1
    data[at] = posterize(data[at] * tone, 6)
    data[at + 1] = posterize(data[at + 1] * tone, 6)
    data[at + 2] = posterize(data[at + 2] * tone, 6)
  }
  return { ...pixels, data }
}

/**
 * A line of `ink` `radius` pixels wide around the opaque pixels, drawn on
 * the clear pixels next to them.
 */
export function inkOutline(pixels: Pixels, radius: number, ink: Rgb): Pixels {
  const { width, height } = pixels
  const source = pixels.data
  const data = new Uint8ClampedArray(source)
  const solid = (x: number, y: number) =>
    x >= 0 &&
    y >= 0 &&
    x < width &&
    y < height &&
    source[(y * width + x) * 4 + 3] >= SOLID
  const near = (x: number, y: number) => {
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++)
        if (dx * dx + dy * dy <= radius * radius && solid(x + dx, y + dy))
          return true
    return false
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (solid(x, y) || !near(x, y)) continue
      const at = (y * width + x) * 4
      data.set([...ink, 255], at)
    }
  }
  return { ...pixels, data }
}
