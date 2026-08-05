import type { Rect, Transform } from '../node'
import type { Bitmap } from './place'

export function placedBounds(t: Transform): Rect {
  const cx = t.x + t.w / 2
  const cy = t.y + t.h / 2
  const cos = Math.cos(t.rotation)
  const sin = Math.sin(t.rotation)
  const hw = t.w / 2
  const hh = t.h / 2
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [dx, dy] of [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh]
  ] as const) {
    const px = cx + dx * cos - dy * sin
    const py = cy + dx * sin + dy * cos
    minX = Math.min(minX, px)
    minY = Math.min(minY, py)
    maxX = Math.max(maxX, px)
    maxY = Math.max(maxY, py)
  }
  const x = Math.floor(minX)
  const y = Math.floor(minY)
  return {
    x,
    y,
    w: Math.max(1, Math.ceil(maxX) - x),
    h: Math.max(1, Math.ceil(maxY) - y)
  }
}

export function isIdentityPlacement(
  t: Transform,
  naturalW: number,
  naturalH: number
): boolean {
  return (
    t.rotation === 0 &&
    Math.round(t.w) === naturalW &&
    Math.round(t.h) === naturalH
  )
}

export function drawPlacedInto(
  ctx: CanvasRenderingContext2D,
  bitmap: Bitmap,
  t: Transform,
  originX: number,
  originY: number
): void {
  ctx.save()
  ctx.translate(t.x + t.w / 2 - originX, t.y + t.h / 2 - originY)
  ctx.rotate(t.rotation)
  ctx.drawImage(bitmap, -t.w / 2, -t.h / 2, t.w, t.h)
  ctx.restore()
}

export function bakePlaced(
  bitmap: Bitmap,
  t: Transform
): { canvas: HTMLCanvasElement; bounds: Rect } | null {
  const bounds = placedBounds(t)
  const canvas = document.createElement('canvas')
  canvas.width = bounds.w
  canvas.height = bounds.h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  drawPlacedInto(ctx, bitmap, t, bounds.x, bounds.y)
  return { canvas, bounds }
}

export function bakeMaskInto(
  maskBitmap: Bitmap,
  oldTransform: Transform,
  bounds: Rect,
  fill: 'white' | 'black'
): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas')
  canvas.width = bounds.w
  canvas.height = bounds.h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = fill === 'white' ? '#ffffff' : '#000000'
  ctx.fillRect(0, 0, bounds.w, bounds.h)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  drawPlacedInto(ctx, maskBitmap, oldTransform, bounds.x, bounds.y)
  return canvas
}
