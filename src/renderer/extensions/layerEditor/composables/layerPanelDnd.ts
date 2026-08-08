export type LayerDropPos = 'above' | 'below'

export function dropPositionFor(ratio: number): LayerDropPos {
  return ratio < 0.5 ? 'above' : 'below'
}

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
