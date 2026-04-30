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
