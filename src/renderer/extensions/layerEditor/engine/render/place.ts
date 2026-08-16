import type { Rect, Transform } from '../node'

export type Bitmap = HTMLCanvasElement | ImageBitmap | OffscreenCanvas

const mipChains = new WeakMap<Bitmap, HTMLCanvasElement[]>()

function halve(src: Bitmap | HTMLCanvasElement): HTMLCanvasElement | null {
  const w = Math.max(1, Math.floor(src.width / 2))
  const h = Math.max(1, Math.floor(src.height / 2))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  if (!g) return null
  g.imageSmoothingEnabled = true
  g.imageSmoothingQuality = 'high'
  g.drawImage(src, 0, 0, w, h)
  return c
}

export function mipForScale(bitmap: Bitmap, scale: number): Bitmap {
  if (scale >= 0.5 || bitmap.width <= 1 || bitmap.height <= 1) return bitmap
  let levels = mipChains.get(bitmap)
  if (!levels) {
    levels = []
    mipChains.set(bitmap, levels)
  }
  let level = 0
  let remaining = scale
  while (remaining < 0.5) {
    const prev: Bitmap | HTMLCanvasElement =
      level === 0 ? bitmap : levels[level - 1]
    if (prev.width <= 1 || prev.height <= 1) break
    if (!levels[level]) {
      const next = halve(prev)
      if (!next) break
      levels[level] = next
    }
    remaining *= 2
    level += 1
  }
  return level === 0 ? bitmap : levels[level - 1]
}

export function placeBitmap(
  bitmap: Bitmap,
  transform: Transform,
  docWidth: number,
  docHeight: number,
  scratch?: HTMLCanvasElement,
  clipRect?: Rect | null,
  noMip = false
): HTMLCanvasElement | null {
  const canvas = scratch ?? document.createElement('canvas')
  const clip =
    clipRect &&
    scratch &&
    canvas.width === docWidth &&
    canvas.height === docHeight
      ? clipRect
      : null
  if (canvas.width !== docWidth) canvas.width = docWidth
  if (canvas.height !== docHeight) canvas.height = docHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const scale = Math.max(
    transform.w / Math.max(1, bitmap.width),
    transform.h / Math.max(1, bitmap.height)
  )
  const src = noMip ? bitmap : mipForScale(bitmap, scale)
  ctx.save()
  if (clip) {
    ctx.beginPath()
    ctx.rect(clip.x, clip.y, clip.w, clip.h)
    ctx.clip()
    ctx.clearRect(clip.x, clip.y, clip.w, clip.h)
  } else {
    ctx.clearRect(0, 0, docWidth, docHeight)
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.translate(transform.x + transform.w / 2, transform.y + transform.h / 2)
  ctx.rotate(transform.rotation)
  ctx.drawImage(
    src,
    -transform.w / 2,
    -transform.h / 2,
    transform.w,
    transform.h
  )
  ctx.restore()
  return canvas
}
