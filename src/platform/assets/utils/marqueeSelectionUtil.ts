export interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

export interface MarqueeCard {
  id: string
  rect: Box
}

export function normalizeMarqueeRect(
  start: { x: number; y: number },
  end: { x: number; y: number }
): Box {
  return {
    left: Math.min(start.x, end.x),
    top: Math.min(start.y, end.y),
    right: Math.max(start.x, end.x),
    bottom: Math.max(start.y, end.y)
  }
}

function rectsIntersect(a: Box, b: Box): boolean {
  return !(
    a.right < b.left ||
    a.left > b.right ||
    a.bottom < b.top ||
    a.top > b.bottom
  )
}

/**
 * Resolve the asset ids a marquee covers, starting from `baseIds` (the selection
 * to preserve when a modifier makes the drag additive). A fresh Set is returned;
 * `baseIds` is never mutated.
 */
export function selectMarqueeIds(
  cards: readonly MarqueeCard[],
  marquee: Box,
  baseIds: Iterable<string> = []
): Set<string> {
  const result = new Set(baseIds)
  for (const { id, rect } of cards) {
    if (rectsIntersect(rect, marquee)) {
      result.add(id)
    }
  }
  return result
}
