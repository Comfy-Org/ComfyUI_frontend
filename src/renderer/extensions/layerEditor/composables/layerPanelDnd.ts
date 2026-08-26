export type LayerDropPos = 'above' | 'below'

export function dropPositionFor(ratio: number): LayerDropPos {
  return ratio < 0.5 ? 'above' : 'below'
}

/**
 * Target index in root.children for a panel drag-drop.
 * @param bottomUpIds ids ordered z=0 (bottom) first - the inverse of the
 *   panel's display order, so visually "above" means a higher index.
 * @param offset reserved bottom slots (1 when a background fill is pinned).
 */
export function reorderDropIndex(
  bottomUpIds: readonly string[],
  targetId: string,
  pos: LayerDropPos,
  offset: number
): number | null {
  const index = bottomUpIds.indexOf(targetId)
  if (index === -1) return null
  return offset + (pos === 'above' ? index + 1 : index)
}
