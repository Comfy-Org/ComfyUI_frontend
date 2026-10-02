import type { TryOnFit } from './contract'

/** A point on the photo, 0 to 1 across and down. */
export interface Point {
  readonly x: number
  readonly y: number
}

/** A part of an image, 0 to 1 across and down. */
export interface Area {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export interface TryOnGarment {
  readonly id: string
  readonly url: string
  readonly name: string
  /** Where the mock reads the fabric from, so it repeats only cloth. */
  readonly fabric: Area
}

export const EXAMPLE_GARMENTS = [
  {
    id: 'breton',
    url: '/images/apps/virtual-try-on/garment-breton.jpg',
    fabric: { x: 0.36, y: 0.4, w: 0.28, h: 0.28 }
  },
  {
    id: 'flannel',
    url: '/images/apps/virtual-try-on/garment-flannel.jpg',
    fabric: { x: 0.53, y: 0.5, w: 0.16, h: 0.2 }
  },
  {
    id: 'knit',
    url: '/images/apps/virtual-try-on/garment-knit.jpg',
    fabric: { x: 0.42, y: 0.4, w: 0.16, h: 0.28 }
  }
] as const satisfies readonly Omit<TryOnGarment, 'name'>[]

/** An uploaded garment is read from its middle. */
export const UPLOAD_FABRIC: Area = { x: 0.38, y: 0.38, w: 0.24, h: 0.24 }

/** The jacket in the example photo, traced clockwise from the collar. */
export const EXAMPLE_TORSO: readonly Point[] = [
  { x: 0.533, y: 0.35 },
  { x: 0.456, y: 0.403 },
  { x: 0.4, y: 0.458 },
  { x: 0.367, y: 0.517 },
  { x: 0.356, y: 0.583 },
  { x: 0.356, y: 0.694 },
  { x: 0.362, y: 0.806 },
  { x: 0.378, y: 0.889 },
  { x: 0.396, y: 0.947 },
  { x: 0.556, y: 0.961 },
  { x: 0.711, y: 0.958 },
  { x: 0.769, y: 0.944 },
  { x: 0.782, y: 0.861 },
  { x: 0.813, y: 0.778 },
  { x: 0.889, y: 0.75 },
  { x: 0.911, y: 0.694 },
  { x: 0.902, y: 0.642 },
  { x: 0.849, y: 0.611 },
  { x: 0.827, y: 0.556 },
  { x: 0.84, y: 0.489 },
  { x: 0.778, y: 0.424 },
  { x: 0.702, y: 0.392 },
  { x: 0.662, y: 0.367 },
  { x: 0.6, y: 0.347 }
]

/** A front-facing torso, for a photo the mock knows nothing about. */
export const UPLOAD_TORSO: readonly Point[] = [
  { x: 0.42, y: 0.34 },
  { x: 0.3, y: 0.38 },
  { x: 0.26, y: 0.5 },
  { x: 0.29, y: 0.62 },
  { x: 0.3, y: 0.86 },
  { x: 0.5, y: 0.9 },
  { x: 0.7, y: 0.86 },
  { x: 0.71, y: 0.62 },
  { x: 0.74, y: 0.5 },
  { x: 0.7, y: 0.38 },
  { x: 0.58, y: 0.34 },
  { x: 0.5, y: 0.37 }
]

const FIT_SCALE = {
  slim: { x: 1, y: 1 },
  regular: { x: 1.04, y: 1.025 },
  relaxed: { x: 1.08, y: 1.05 }
} as const satisfies Record<TryOnFit, Point>

const clamp = (value: number) => Math.min(1, Math.max(0, value))

/**
 * The garment's outline for a fit: Slim follows the body, Regular and
 * Relaxed grow wider about the middle and longer from the shoulders.
 */
export function fittedOutline(
  outline: readonly Point[],
  fit: TryOnFit
): Point[] {
  const xs = outline.map((point) => point.x)
  const middle = (Math.min(...xs) + Math.max(...xs)) / 2
  const top = Math.min(...outline.map((point) => point.y))
  const scale = FIT_SCALE[fit]
  return outline.map((point) => ({
    x: clamp(middle + (point.x - middle) * scale.x),
    y: clamp(top + (point.y - top) * scale.y)
  }))
}

const round = (value: number) => Math.round(value * 100) / 100

/**
 * A closed, rounded SVG path through the points, scaled to `width` by
 * `height`. Each corner becomes a curve between its edges' midpoints.
 */
export function outlinePath(
  points: readonly Point[],
  width: number,
  height: number
): string {
  if (points.length < 3) return ''
  const at = (index: number) => points[index % points.length]
  const mid = (index: number) => ({
    x: ((at(index).x + at(index + 1).x) / 2) * width,
    y: ((at(index).y + at(index + 1).y) / 2) * height
  })
  const start = mid(0)
  const curves = points.map((_, index) => {
    const corner = at(index + 1)
    const end = mid(index + 1)
    return `Q${round(corner.x * width)} ${round(corner.y * height)} ${round(end.x)} ${round(end.y)}`
  })
  return `M${round(start.x)} ${round(start.y)}${curves.join('')}Z`
}
