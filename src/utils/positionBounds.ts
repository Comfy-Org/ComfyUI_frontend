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
  if (!Number.isFinite(minX)) return null
  return [
    minX - padding,
    minY - padding,
    maxX - minX + padding * 2,
    maxY - minY + padding * 2
  ]
}
