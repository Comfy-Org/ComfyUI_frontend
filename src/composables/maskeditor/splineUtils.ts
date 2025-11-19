import type { Point } from '@/extensions/core/maskeditor/types'

/**
 * Evaluates a Catmull-Rom spline at parameter t between p1 and p2
 * @param p0 Previous control point
 * @param p1 Start point of the curve segment
 * @param p2 End point of the curve segment
 * @param p3 Next control point
 * @param t Parameter in range [0, 1]
 * @returns Interpolated point on the curve
 */
export function catmullRomSpline(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number
): Point {
  // Centripetal Catmull-Rom Spline (alpha = 0.5)
  // This prevents loops and overshoots when control points are unevenly spaced.
  const alpha = 0.5

  const getT = (t: number, p0: Point, p1: Point) => {
    const d = Math.hypot(p1.x - p0.x, p1.y - p0.y)
    return t + Math.pow(d, alpha)
  }

  const t0 = 0
  const t1 = getT(t0, p0, p1)
  const t2 = getT(t1, p1, p2)
  const t3 = getT(t2, p2, p3)

  // Map t (0..1) to the actual parameter range (t1..t2)
  const tInterp = t1 + (t2 - t1) * t

  // Helper for safe interpolation when time intervals are zero (coincident points)
  const interp = (
    pA: Point,
    pB: Point,
    tA: number,
    tB: number,
    t: number
  ): Point => {
    if (Math.abs(tB - tA) < 0.0001) return pA
    const k = (t - tA) / (tB - tA)
    return add(mul(pA, 1 - k), mul(pB, k))
  }

  // Barry-Goldman pyramidal formulation
  const A1 = interp(p0, p1, t0, t1, tInterp)
  const A2 = interp(p1, p2, t1, t2, tInterp)
  const A3 = interp(p2, p3, t2, t3, tInterp)

  const B1 = interp(A1, A2, t0, t2, tInterp)
  const B2 = interp(A2, A3, t1, t3, tInterp)

  const C = interp(B1, B2, t1, t2, tInterp)

  return C
}

function add(p1: Point, p2: Point): Point {
  return { x: p1.x + p2.x, y: p1.y + p2.y }
}

function mul(p: Point, s: number): Point {
  return { x: p.x * s, y: p.y * s }
}

/**
 * Resamples a curve segment with a starting offset (remainder from previous segment).
 * Returns the resampled points and the new remainder distance.
 *
 * @param points Points defining the curve segment
 * @param spacing Desired spacing between points
 * @param startOffset Distance to travel before placing the first point (remainder)
 * @returns Object containing points and new remainder
 */
export function resampleSegment(
  points: Point[],
  spacing: number,
  startOffset: number
): { points: Point[]; remainder: number } {
  if (points.length === 0) return { points: [], remainder: startOffset }

  const result: Point[] = []
  let currentDist = 0
  let nextSampleDist = startOffset

  // We iterate through the dense points of the segment
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i]
    const p2 = points[i + 1]

    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    const segmentLen = Math.hypot(dx, dy)

    // While the next sample falls within this segment
    while (nextSampleDist <= currentDist + segmentLen) {
      const t = (nextSampleDist - currentDist) / segmentLen

      // Interpolate
      const x = p1.x + t * dx
      const y = p1.y + t * dy
      result.push({ x, y })

      nextSampleDist += spacing
    }

    currentDist += segmentLen
  }

  // The remainder is how far past the last point the next sample would be
  // relative to the end of the segment.
  // Actually, simpler: remainder = nextSampleDist - totalLength
  const remainder = nextSampleDist - currentDist

  return { points: result, remainder }
}
