/* Graph units around the framed items so none sit flush with the edge. */
const FRAME_PADDING = 40

/**
 * Bounds are taken from `pos`/`size`, the geometry litegraph maintains for
 * canvas and Vue nodes alike (`boundingRect` is a renderer cache that stays
 * zeroed under Vue nodes). Structural rather than class-based so groups frame
 * the same way nodes do.
 */
interface FramableItem {
  pos?: ArrayLike<number>
  size?: ArrayLike<number>
}

export function frameBounds(
  items: readonly FramableItem[]
): [number, number, number, number] | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const item of items) {
    if (!item.pos || !item.size) continue
    minX = Math.min(minX, item.pos[0])
    minY = Math.min(minY, item.pos[1])
    maxX = Math.max(maxX, item.pos[0] + item.size[0])
    maxY = Math.max(maxY, item.pos[1] + item.size[1])
  }
  if (minX === Infinity) return null
  return [
    minX - FRAME_PADDING,
    minY - FRAME_PADDING,
    maxX - minX + FRAME_PADDING * 2,
    maxY - minY + FRAME_PADDING * 2
  ]
}
