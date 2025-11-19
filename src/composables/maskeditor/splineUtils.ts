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
 * Generates a smooth curve through points using Catmull-Rom splines.
 * Densely samples the curve for smoothness - the calling code will handle
 * equidistant spacing for brush dabs.
 *
 * @param points Array of control points (raw mouse/touch positions)
 * @param samplesPerSegment Number of samples per spline segment
 * @returns Array of points forming a smooth curve
 */
export function generateSmoothCurve(
  points: Point[],
  samplesPerSegment: number = 20
): Point[] {
  if (points.length < 2) return points

  // For just 2 points, return linear interpolation
  if (points.length === 2) {
    const result: Point[] = []
    for (let i = 0; i <= samplesPerSegment; i++) {
      const t = i / samplesPerSegment
      result.push({
        x: points[0].x + (points[1].x - points[0].x) * t,
        y: points[0].y + (points[1].y - points[0].y) * t
      })
    }
    return result
  }

  const curvePoints: Point[] = []

  // For each segment between consecutive points
  for (let i = 0; i < points.length - 1; i++) {
    // Get the 4 control points needed for Catmull-Rom
    const p0 = i === 0 ? points[0] : points[i - 1]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = i === points.length - 2 ? points[i + 1] : points[i + 2]

    // Sample the curve segment densely
    // Use more samples for longer segments
    const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y)
    const samples = Math.max(samplesPerSegment, Math.ceil(segLen / 2))

    for (let j = 0; j < samples; j++) {
      const t = j / samples
      curvePoints.push(catmullRomSpline(p0, p1, p2, p3, t))
    }
  }

  // Add the final point
  curvePoints.push(points[points.length - 1])

  return curvePoints
}

/**
 * Resamples a curve at equidistant intervals for uniform brush dab spacing.
 * This solves the density variation problem: fast/slow mouse movements will
 * have the same brush density.
 *
 * @param points Points defining the curve (should be densely sampled)
 * @param spacing Desired spacing between points in pixels
 * @returns Array of equidistant points along the curve
 */
export function resampleEquidistant(points: Point[], spacing: number): Point[] {
  if (points.length === 0) return []
  if (points.length === 1) return [points[0]]

  const result: Point[] = []
  const cumulativeDistances: number[] = [0]

  // Calculate cumulative distances along the curve
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x
    const dy = points[i].y - points[i - 1].y
    const dist = Math.hypot(dx, dy)
    cumulativeDistances[i] = cumulativeDistances[i - 1] + dist
  }

  const totalLength = cumulativeDistances[cumulativeDistances.length - 1]
  if (totalLength < spacing) {
    // Curve is shorter than spacing, just return the endpoints
    return [points[0], points[points.length - 1]]
  }

  const numPoints = Math.floor(totalLength / spacing)

  // Sample at equidistant intervals
  for (let i = 0; i <= numPoints; i++) {
    const targetDistance = i * spacing
    let idx = 0

    // Find the segment containing the target distance
    while (
      idx < cumulativeDistances.length - 1 &&
      cumulativeDistances[idx + 1] < targetDistance
    ) {
      idx++
    }

    if (idx >= points.length - 1) {
      result.push(points[points.length - 1])
      continue
    }

    // Interpolate within the segment
    const d0 = cumulativeDistances[idx]
    const d1 = cumulativeDistances[idx + 1]
    const segmentLength = d1 - d0

    if (segmentLength < 0.001) {
      // Avoid division by zero
      result.push(points[idx])
      continue
    }

    const t = (targetDistance - d0) / segmentLength

    const x = points[idx].x + t * (points[idx + 1].x - points[idx].x)
    const y = points[idx].y + t * (points[idx + 1].y - points[idx].y)

    result.push({ x, y })
  }

  return result
}

/**
 * Generates a smooth, equidistantly sampled stroke through the given points.
 * Two-step process:
 * 1. Generate dense smooth curve using Catmull-Rom splines
 * 2. Resample at equidistant intervals for uniform brush dab spacing
 *
 * @param points Array of control points (raw mouse/touch positions)
 * @param targetSpacing Desired spacing between brush dabs in pixels
 * @returns Array of equidistant points forming a smooth curve
 */
export function generateSmoothStroke(
  points: Point[],
  targetSpacing: number
): Point[] {
  if (points.length < 2) return points

  // Step 1: Generate dense smooth curve
  const denseCurve = generateSmoothCurve(points, 20)

  // Step 2: Resample at equidistant intervals
  const equidistantPoints = resampleEquidistant(denseCurve, targetSpacing)

  return equidistantPoints
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
