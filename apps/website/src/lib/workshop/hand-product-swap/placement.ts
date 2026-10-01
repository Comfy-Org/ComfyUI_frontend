import type { Rect } from '../move-anything/arrange'

/** How much taller than the box a product may grow before it is shrunk. */
const MAX_OVERHANG = 1.6

/**
 * Where a product of this shape lands in the box: as wide as the box, the
 * way a hand grips it, centred on the box. A tall, slim product is shrunk
 * so it never stands more than `MAX_OVERHANG` times the box's height.
 * `aspect` is the box's width over its height in pixels, as the photo is
 * rarely square.
 */
export function gripRect(
  productWidth: number,
  productHeight: number,
  box: Rect,
  aspect: number
): Rect {
  const shape = productHeight / Math.max(productWidth, 1)
  const boxPixelsTall = box.h / Math.max(box.w * aspect, Number.EPSILON)
  const scale = Math.min(1, (MAX_OVERHANG * boxPixelsTall) / shape)
  const w = box.w * scale
  const h = w * aspect * shape
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h }
}

/** A box for a photo the visitor brings: a centred upright one to drag. */
export const STARTING_BOX: Rect = { x: 0.38, y: 0.26, w: 0.24, h: 0.48 }
