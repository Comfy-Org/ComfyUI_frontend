import type { Point } from '@/extensions/core/maskeditor/types'
import { catmullRomSpline, resampleSegment } from './splineUtils'

export class StrokeProcessor {
  private controlPoints: Point[] = []
  private remainder: number = 0
  private spacing: number
  private isFirstPoint: boolean = true

  constructor(spacing: number) {
    this.spacing = spacing
  }

  /**
   * Adds a point to the stroke and returns any new equidistant points generated.
   * Maintains a sliding window of 4 control points to generate Catmull-Rom spline segments.
   */
  public addPoint(point: Point): Point[] {
    // If this is the very first point, we need to initialize the buffer
    if (this.isFirstPoint) {
      this.controlPoints.push(point) // p0 (phantom start)
      this.controlPoints.push(point) // p1 (actual start)
      this.isFirstPoint = false
      return [] // No segment to draw yet
    }

    this.controlPoints.push(point)

    // We need at least 4 points to generate a spline segment (p0, p1, p2, p3)
    // p0: previous control point
    // p1: start of segment
    // p2: end of segment
    // p3: next control point
    if (this.controlPoints.length < 4) {
      return []
    }

    // Generate the segment between p1 and p2
    const p0 = this.controlPoints[0]
    const p1 = this.controlPoints[1]
    const p2 = this.controlPoints[2]
    const p3 = this.controlPoints[3]

    const newPoints = this.processSegment(p0, p1, p2, p3)

    // Slide the window: remove p0
    this.controlPoints.shift()

    return newPoints
  }

  /**
   * Ends the stroke, flushing any remaining segments.
   * This adds a phantom end point to complete the last segment.
   */
  public endStroke(): Point[] {
    if (this.controlPoints.length < 2) {
      // Not enough points to form a segment
      return []
    }

    // If we have [p0, p1, p2], we need to process the segment p1->p2
    // We duplicate p2 as p3 (phantom end point)
    // If we have [p0, p1], we duplicate p1 as p2 and p3 (single point stroke case handled elsewhere usually, but good for safety)

    const newPoints: Point[] = []

    // To properly flush, we essentially pretend we added one last point which is the same as the last point
    // But we might have multiple points in buffer.
    // Actually, the sliding window ensures we always have [p(n-2), p(n-1), p(n)].
    // We need to process p(n-1)->p(n).
    // So we just need to supply p(n) as the "next" control point (p3).

    while (this.controlPoints.length >= 3) {
      const p0 = this.controlPoints[0]
      const p1 = this.controlPoints[1]
      const p2 = this.controlPoints[2]
      const p3 = p2 // Duplicate last point

      const points = this.processSegment(p0, p1, p2, p3)
      newPoints.push(...points)

      this.controlPoints.shift()
    }

    return newPoints
  }

  private processSegment(p0: Point, p1: Point, p2: Point, p3: Point): Point[] {
    // Generate dense points for the segment
    // We use a fixed high resolution for the dense curve
    const densePoints: Point[] = []
    const samples = 20 // Or adaptive based on distance

    // We can use adaptive sampling if needed, but fixed is usually fine for small segments
    // Let's use a simple loop for now, similar to generateSmoothCurve but for one segment
    for (let i = 0; i < samples; i++) {
      const t = i / samples
      densePoints.push(catmullRomSpline(p0, p1, p2, p3, t))
    }
    // Add the end point of the segment
    densePoints.push(p2)

    // Resample using the carried-over remainder
    const { points, remainder } = resampleSegment(
      densePoints,
      this.spacing,
      this.remainder
    )

    this.remainder = remainder
    return points
  }
}
