import type { Point } from '@/lib/litegraph/src/interfaces'
import { LinkDirection } from '@/lib/litegraph/src/types/globalEnums'

export type CubicBezier = readonly [Point, Point, Point, Point]

const SPLINE_CONTROL_RATIO = 0.25

function lerp(from: Point, to: Point, t: number): Point {
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]
}

function controlOffset(direction: LinkDirection, distance: number): Point {
  switch (direction) {
    case LinkDirection.LEFT:
      return [-distance, 0]
    case LinkDirection.RIGHT:
      return [distance, 0]
    case LinkDirection.UP:
      return [0, -distance]
    case LinkDirection.DOWN:
      return [0, distance]
    default:
      return [0, 0]
  }
}

/** The splines a link is drawn along from its output, through each reroute, to its input. */
export function linkSplineChain(
  points: readonly Point[],
  startDirection: LinkDirection,
  endDirection: LinkDirection
): CubicBezier[] {
  const last = points.length - 2
  return points
    .slice(0, -1)
    .map((from, index) =>
      linkSpline(
        from,
        points[index + 1],
        index === 0 ? startDirection : LinkDirection.CENTER,
        index === last ? endDirection : LinkDirection.CENTER
      )
    )
}

function chordLength([start, , , end]: CubicBezier): number {
  return Math.hypot(end[0] - start[0], end[1] - start[1])
}

/** The first `fraction` of a chain of curves, measured along their chords. */
export function chainHead(
  chain: readonly CubicBezier[],
  fraction: number
): CubicBezier[] {
  const lengths = chain.map(chordLength)
  const total = lengths.reduce((sum, length) => sum + length, 0)
  const head: CubicBezier[] = []
  let remaining = fraction * total
  for (const [index, curve] of chain.entries()) {
    if (remaining <= 0) break
    const length = lengths[index]
    if (remaining >= length) {
      head.push(curve)
    } else {
      head.push(bezierHead(curve, remaining / length))
    }
    remaining -= length
  }
  return head
}

/** The last `fraction` of a chain of curves, measured along their chords. */
export function chainTail(
  chain: readonly CubicBezier[],
  fraction: number
): CubicBezier[] {
  const reversed = chain
    .map(([p0, p1, p2, p3]): CubicBezier => [p3, p2, p1, p0])
    .reverse()
  return chainHead(reversed, fraction)
    .map(([p0, p1, p2, p3]): CubicBezier => [p3, p2, p1, p0])
    .reverse()
}

/** The spline a link is drawn along between two slots. */
export function linkSpline(
  start: Point,
  end: Point,
  startDirection: LinkDirection,
  endDirection: LinkDirection
): CubicBezier {
  const distance =
    Math.hypot(end[0] - start[0], end[1] - start[1]) * SPLINE_CONTROL_RATIO
  const [startX, startY] = controlOffset(startDirection, distance)
  const [endX, endY] = controlOffset(endDirection, distance)
  return [
    start,
    [start[0] + startX, start[1] + startY],
    [end[0] + endX, end[1] + endY],
    end
  ]
}

/** The part of a curve from its start up to `t`. */
export function bezierHead(
  [p0, p1, p2, p3]: CubicBezier,
  t: number
): CubicBezier {
  const a = lerp(p0, p1, t)
  const b = lerp(p1, p2, t)
  const c = lerp(p2, p3, t)
  const ab = lerp(a, b, t)
  const bc = lerp(b, c, t)
  return [p0, a, ab, lerp(ab, bc, t)]
}

/** The part of a curve from `1 - t` to its end. */
export function bezierTail(
  [p0, p1, p2, p3]: CubicBezier,
  t: number
): CubicBezier {
  const [q0, q1, q2, q3] = bezierHead([p3, p2, p1, p0], t)
  return [q3, q2, q1, q0]
}
