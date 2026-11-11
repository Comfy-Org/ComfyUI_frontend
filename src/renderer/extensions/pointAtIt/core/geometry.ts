export interface Point {
  x: number
  y: number
}

interface Size {
  width: number
  height: number
}

export interface Rect extends Point, Size {}

export type Side = 'right' | 'left' | 'below' | 'above'

const COVERAGE_GRID = 5
const PLACEMENT_GAP = 12
const VIEWPORT_MARGIN = 8

export function rectContains(rect: Rect, point: Point): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  )
}

export function rectCenter(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

export function boundsOf(points: readonly Point[]): Rect {
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

export function unionRects(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null
  return boundsOf(
    rects.flatMap((rect) => [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.width, y: rect.y + rect.height }
    ])
  )
}

function insidePolygon(point: Point, polygon: readonly Point[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]
    const b = polygon[j]
    const crosses =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    if (crosses) inside = !inside
  }
  return inside
}

/** Share of `rect` that lies inside the closed outline, sampled on a grid. */
export function coveredFraction(rect: Rect, outline: readonly Point[]): number {
  if (outline.length < 3) return 0
  const samples = Array.from(
    { length: COVERAGE_GRID * COVERAGE_GRID },
    (_, index) => ({
      x:
        rect.x + ((index % COVERAGE_GRID) + 0.5) * (rect.width / COVERAGE_GRID),
      y:
        rect.y +
        (Math.floor(index / COVERAGE_GRID) + 0.5) *
          (rect.height / COVERAGE_GRID)
    })
  )
  const inside = samples.filter((sample) => insidePolygon(sample, outline))
  return inside.length / samples.length
}

/** True when the centre of `rect` is inside `viewport`. */
export function isInView(rect: Rect, viewport: Rect): boolean {
  return rectContains(viewport, rectCenter(rect))
}

function sidePosition(anchor: Rect, size: Size, side: Side): Point {
  if (side === 'right')
    return { x: anchor.x + anchor.width + PLACEMENT_GAP, y: anchor.y }
  if (side === 'left')
    return { x: anchor.x - size.width - PLACEMENT_GAP, y: anchor.y }
  if (side === 'below')
    return { x: anchor.x, y: anchor.y + anchor.height + PLACEMENT_GAP }
  return { x: anchor.x, y: anchor.y - size.height - PLACEMENT_GAP }
}

function fits(position: Point, size: Size, viewport: Size): boolean {
  return (
    position.x >= VIEWPORT_MARGIN &&
    position.y >= VIEWPORT_MARGIN &&
    position.x + size.width <= viewport.width - VIEWPORT_MARGIN &&
    position.y + size.height <= viewport.height - VIEWPORT_MARGIN
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, Math.max(min, max)))
}

/**
 * Top-left corner for a box placed next to `anchor`: the first side in
 * `order` where it fits the window, otherwise the first side pulled inside.
 */
export function placeBeside(
  anchor: Rect,
  size: Size,
  viewport: Size,
  order: readonly Side[]
): Point {
  const candidates = order.map((side) => sidePosition(anchor, size, side))
  const chosen =
    candidates.find((candidate) => fits(candidate, size, viewport)) ??
    candidates[0]
  return {
    x: clamp(
      chosen.x,
      VIEWPORT_MARGIN,
      viewport.width - size.width - VIEWPORT_MARGIN
    ),
    y: clamp(
      chosen.y,
      VIEWPORT_MARGIN,
      viewport.height - size.height - VIEWPORT_MARGIN
    )
  }
}

const FLIGHT_MS = 450

/** Where a pointer flying from `from` to `to` is after `elapsedMs`. */
export function flightPosition(
  from: Point,
  to: Point,
  elapsedMs: number
): Point {
  const progress = clamp(elapsedMs / FLIGHT_MS, 0, 1)
  const eased = 1 - (1 - progress) ** 3
  return {
    x: from.x + (to.x - from.x) * eased,
    y: from.y + (to.y - from.y) * eased
  }
}
