export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface Rect extends Point, Size {}

export type Side = 'right' | 'left' | 'below' | 'above'

const COVERAGE_GRID = 5
const PLACEMENT_GAP = 12
const VIEWPORT_MARGIN = 8
const ATTACH_GAP = 16
const TAIL_INSET = 20

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

function pullInside(position: Point, size: Size, viewport: Size): Point {
  return {
    x: clamp(
      position.x,
      VIEWPORT_MARGIN,
      viewport.width - size.width - VIEWPORT_MARGIN
    ),
    y: clamp(
      position.y,
      VIEWPORT_MARGIN,
      viewport.height - size.height - VIEWPORT_MARGIN
    )
  }
}

function covers(position: Point, size: Size, other: Rect | null): boolean {
  return (
    other !== null &&
    position.x < other.x + other.width &&
    position.x + size.width > other.x &&
    position.y < other.y + other.height &&
    position.y + size.height > other.y
  )
}

function firstFree<T extends { position: Point }>(
  candidates: readonly T[],
  size: Size,
  viewport: Size,
  avoid: Rect | null
): T {
  const fitting = candidates.filter((candidate) =>
    fits(candidate.position, size, viewport)
  )
  return (
    fitting.find((candidate) => !covers(candidate.position, size, avoid)) ??
    fitting.at(0) ??
    candidates[0]
  )
}

/**
 * Top-left corner for a box placed next to `anchor`: the first side in
 * `order` where it fits the window and stays clear of `avoid`, otherwise the
 * first side where it fits, otherwise the first side pulled inside.
 */
export function placeBeside(
  anchor: Rect,
  size: Size,
  viewport: Size,
  order: readonly Side[],
  avoid: Rect | null = null
): Point {
  const candidates = order.map((side) => ({
    position: sidePosition(anchor, size, side)
  }))
  const chosen = firstFree(candidates, size, viewport, avoid)
  return pullInside(chosen.position, size, viewport)
}

export interface Attachment {
  position: Point
  side: Side
  tail: number
}

function attachedPosition(anchor: Rect, size: Size, side: Side): Point {
  const centre = rectCenter(anchor)
  if (side === 'right')
    return {
      x: anchor.x + anchor.width + ATTACH_GAP,
      y: centre.y - TAIL_INSET
    }
  if (side === 'left')
    return {
      x: anchor.x - size.width - ATTACH_GAP,
      y: centre.y - TAIL_INSET
    }
  if (side === 'below')
    return {
      x: centre.x - TAIL_INSET,
      y: anchor.y + anchor.height + ATTACH_GAP
    }
  return { x: centre.x - TAIL_INSET, y: anchor.y - size.height - ATTACH_GAP }
}

export function placeAttached(
  anchor: Rect,
  size: Size,
  viewport: Size,
  order: readonly Side[],
  avoid: Rect | null = null
): Attachment {
  const candidates = order.map((side) => ({
    side,
    position: attachedPosition(anchor, size, side)
  }))
  const chosen = firstFree(candidates, size, viewport, avoid)
  const position = pullInside(chosen.position, size, viewport)
  const centre = rectCenter(anchor)
  const alongX = chosen.side === 'above' || chosen.side === 'below'
  const reach = alongX ? centre.x - position.x : centre.y - position.y
  const extent = alongX ? size.width : size.height
  return {
    position,
    side: chosen.side,
    tail: clamp(reach, TAIL_INSET, extent - TAIL_INSET)
  }
}

/** Which way a finger points on screen: she faces front and points to a side. */
export type Pointing = 'left' | 'right'

export interface Standing {
  position: Point
  points: Pointing
}

export interface StandingOptions {
  /**
   * The ways she may point, best first. Pointing right means she stands left
   * of the target, pointing left means she stands right of it.
   */
  order: readonly Pointing[]
  /** Boxes she should not stand on, when another way is free. */
  avoid: readonly (Rect | null)[]
  /** Where her fingertip is inside her box when she points each way. */
  fingertips: Record<Pointing, Point>
  /** The space between her fingertip and the target. */
  gap: number
}

function standingPosition(
  target: Rect,
  points: Pointing,
  { fingertips, gap }: Pick<StandingOptions, 'fingertips' | 'gap'>
): Point {
  const tip = fingertips[points]
  const x =
    points === 'right'
      ? target.x - gap - tip.x
      : target.x + target.width + gap - tip.x
  return { x, y: rectCenter(target).y - tip.y }
}

/**
 * Top-left corner of a box that stands beside `target` with its fingertip
 * level with the target's centre: the first way in `order` that keeps the gap
 * inside the window and stays clear of everything in `avoid`, otherwise the
 * first way that keeps the gap, otherwise the first way pulled inside. Up and
 * down the box is moved to fit rather than sent to the other side.
 */
export function placeStanding(
  target: Rect,
  size: Size,
  viewport: Size,
  options: StandingOptions
): Standing {
  const candidates = options.order.map((points) => {
    const wanted = standingPosition(target, points, options)
    const position = pullInside(wanted, size, viewport)
    return { points, position, keepsGap: position.x === wanted.x }
  })
  const roomy = candidates.filter((candidate) => candidate.keepsGap)
  const clear = roomy.find(
    (candidate) =>
      !options.avoid.some((other) => covers(candidate.position, size, other))
  )
  const chosen = clear ?? roomy.at(0) ?? candidates[0]
  return { position: chosen.position, points: chosen.points }
}

const PANEL_GAP = 8
const ASK_BOTTOM_GAP = 10
const DOCK_SIDE_GAP = 40
const SLOT_SHARE = 0.6
const SLOT_MIN_WIDTH = 320
const SLOT_MAX_WIDTH = 640
const DOCK_MIN_CAP = 160
const DOCK_CAP_SHARE = 1 / 3

function visibleArea(canvas: Rect, viewport: Size): Rect {
  return canvas.width > 0
    ? canvas
    : { x: 0, y: 0, width: viewport.width, height: viewport.height }
}

export function placeAsk(
  canvas: Rect,
  viewport: Size
): { centerX: number; bottom: number } {
  const area = visibleArea(canvas, viewport)
  return {
    centerX: area.x + area.width / 2,
    bottom: viewport.height - (area.y + area.height) + ASK_BOTTOM_GAP
  }
}

/**
 * Top-left corner of a box that stands at the bottom left of the visible
 * canvas, on the same baseline as the Ask column at the bottom centre.
 */
export function placeDock(canvas: Rect, size: Size, viewport: Size): Point {
  const area = visibleArea(canvas, viewport)
  return {
    x: area.x + DOCK_SIDE_GAP,
    y: area.y + area.height - ASK_BOTTOM_GAP - size.height
  }
}

export function slotWidth(canvas: Rect, viewport: Size): number {
  const area = visibleArea(canvas, viewport)
  const wanted = Math.min(
    SLOT_MAX_WIDTH,
    Math.max(SLOT_MIN_WIDTH, area.width * SLOT_SHARE)
  )
  return Math.max(0, Math.min(wanted, area.width - VIEWPORT_MARGIN * 2))
}

export function dockCap(canvas: Rect, viewport: Size): number {
  const area = visibleArea(canvas, viewport)
  return Math.max(DOCK_MIN_CAP, area.height * DOCK_CAP_SHARE)
}

export function placeStrip(
  canvas: Rect,
  size: Size,
  viewport: Size,
  avoid: Rect | null
): Point {
  const area = visibleArea(canvas, viewport)
  const centred = {
    x: area.x + area.width - VIEWPORT_MARGIN - size.width,
    y: Math.max(
      area.y + VIEWPORT_MARGIN,
      area.y + (area.height - size.height) / 2
    )
  }
  if (!avoid || !covers(centred, size, avoid)) return centred
  return {
    x: Math.max(VIEWPORT_MARGIN, avoid.x - PANEL_GAP - size.width),
    y: centred.y
  }
}

export const FLIGHT_MS = 450

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
