import type { Point } from '@/extensions/core/maskeditor/types'

import type { DirtyRect } from './brushDrawingUtils'

/**
 * Computes the clamped dirty-rect coordinates for a putImageData call.
 *
 * Returns the full canvas dimensions when the dirty rect is uninitialised
 * (Infinity sentinels) or the resulting area has zero/negative size.
 */
export function clampDirtyRect(
  rect: DirtyRect,
  canvasWidth: number,
  canvasHeight: number
): { dx: number; dy: number; dw: number; dh: number } {
  const full = { dx: 0, dy: 0, dw: canvasWidth, dh: canvasHeight }
  if (rect.minX === Infinity || rect.maxX === -Infinity) return full

  const dx = Math.floor(Math.max(0, rect.minX))
  const dy = Math.floor(Math.max(0, rect.minY))
  const dw = Math.ceil(Math.min(canvasWidth, rect.maxX)) - dx
  const dh = Math.ceil(Math.min(canvasHeight, rect.maxY)) - dy

  return dw > 0 && dh > 0 ? { dx, dy, dw, dh } : full
}

/**
 * Linearly interpolates a sequence of points at a fixed step size,
 * returning GPU-ready stroke points with pressure=1.
 *
 * When skipResampling is true the input points are returned as-is (used
 * during live preview where the caller has already handled spacing).
 */
export function buildStrokePoints(
  points: Point[],
  skipResampling: boolean,
  stepSize: number
): { x: number; y: number; pressure: number }[] {
  if (skipResampling) {
    return points.map((p) => ({ x: p.x, y: p.y, pressure: 1.0 }))
  }
  const result: { x: number; y: number; pressure: number }[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i]
    const p2 = points[i + 1]
    const steps = Math.max(
      1,
      Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / stepSize)
    )
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      result.push({
        x: p1.x + (p2.x - p1.x) * t,
        y: p1.y + (p2.y - p1.y) * t,
        pressure: 1.0
      })
    }
  }
  return result
}
