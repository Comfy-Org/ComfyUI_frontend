import type { ReadOnlyRect } from '@/lib/litegraph/src/interfaces'

interface PositionableItem {
  pos?: ArrayLike<number>
  size?: ArrayLike<number>
}

export function createPositionBounds(
  items: Iterable<PositionableItem>,
  padding: number
): ReadOnlyRect | null {
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
  if (!Number.isFinite(minX)) return null
  return [
    minX - padding,
    minY - padding,
    maxX - minX + padding * 2,
    maxY - minY + padding * 2
  ]
}
