import type { ReadOnlyRect } from '@/lib/litegraph/src/interfaces'

interface PositionableItem {
  pos?: ArrayLike<number>
  size?: ArrayLike<number>
}

export interface PositionExtents {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function calculatePositionExtents(
  items: Iterable<PositionableItem>
): PositionExtents | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const item of items) {
    if (!item.pos || !item.size) continue
    const x = item.pos[0]
    const y = item.pos[1]
    const width = item.size[0]
    const height = item.size[1]
    if (![x, y, width, height].every(Number.isFinite)) continue
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + width)
    maxY = Math.max(maxY, y + height)
  }
  return minX === Infinity ? null : { minX, minY, maxX, maxY }
}

export function createPositionBounds(
  items: Iterable<PositionableItem>,
  padding: number
): ReadOnlyRect | null {
  if (!Number.isFinite(padding)) return null
  const extents = calculatePositionExtents(items)
  if (!extents) return null
  const { minX, minY, maxX, maxY } = extents
  return [
    minX - padding,
    minY - padding,
    maxX - minX + padding * 2,
    maxY - minY + padding * 2
  ]
}
