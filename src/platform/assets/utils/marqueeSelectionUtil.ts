import type { RectEdges } from '@/utils/mathUtil'

export interface MarqueeCard {
  id: string
  rect: RectEdges
}

export function normalizeMarqueeRect(
  start: { x: number; y: number },
  end: { x: number; y: number }
): RectEdges {
  return {
    left: Math.min(start.x, end.x),
    top: Math.min(start.y, end.y),
    right: Math.max(start.x, end.x),
    bottom: Math.max(start.y, end.y)
  }
}

function rectsIntersect(a: RectEdges, b: RectEdges): boolean {
  return !(
    a.right < b.left ||
    a.left > b.right ||
    a.bottom < b.top ||
    a.top > b.bottom
  )
}

/**
 * Resolve the asset ids a marquee covers, starting from `baseIds` (the selection
 * to preserve when a modifier makes the drag additive). With `subtract`, covered
 * ids are removed from `baseIds` instead of added. A fresh Set is returned;
 * `baseIds` is never mutated.
 */
export function selectMarqueeIds(
  cards: readonly MarqueeCard[],
  marquee: RectEdges,
  baseIds: Iterable<string> = [],
  subtract = false
): Set<string> {
  const result = new Set(baseIds)
  for (const { id, rect } of cards) {
    if (!rectsIntersect(rect, marquee)) continue
    if (subtract) result.delete(id)
    else result.add(id)
  }
  return result
}
