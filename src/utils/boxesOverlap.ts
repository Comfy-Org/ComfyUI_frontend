export interface AxisAlignedBox {
  pos: readonly [number, number]
  size: readonly [number, number]
}

/**
 * Axis-aligned bounding box overlap test.
 *
 * Shared by the useDrop unit tests and the drag-and-drop node spacing e2e
 * spec so both exercise the same definition of "overlap" instead of keeping
 * two copies in sync by hand.
 */
export function boxesOverlap(a: AxisAlignedBox, b: AxisAlignedBox): boolean {
  const [ax, ay] = a.pos
  const [aw, ah] = a.size
  const [bx, by] = b.pos
  const [bw, bh] = b.size
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}
