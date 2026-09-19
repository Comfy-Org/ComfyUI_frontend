import type { ReadOnlyRect } from '@/lib/litegraph/src/interfaces'

interface PositionableItem {
  pos?: ArrayLike<number>
  size?: ArrayLike<number>
}

export function createPositionBounds(
  items: Iterable<PositionableItem>,
  padding: number
): ReadOnlyRect | null {
  if (!Number.isFinite(padding)) return null
  const extents: Array<readonly [number, number, number, number]> = []
  for (const item of items) {
    if (!item.pos || !item.size) continue
    const x = item.pos[0]
    const y = item.pos[1]
    const width = item.size[0]
    const height = item.size[1]
    if (![x, y, width, height].every(Number.isFinite)) continue
    extents.push([x, y, x + width, y + height])
  }
  if (extents.length === 0) return null
  const [minX, minY, maxX, maxY] = extents.reduce(
    (bounds, extent) => [
      Math.min(bounds[0], extent[0]),
      Math.min(bounds[1], extent[1]),
      Math.max(bounds[2], extent[2]),
      Math.max(bounds[3], extent[3])
    ]
  )
  return [
    minX - padding,
    minY - padding,
    maxX - minX + padding * 2,
    maxY - minY + padding * 2
  ]
}
