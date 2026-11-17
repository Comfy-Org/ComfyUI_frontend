import type { Side } from './geometry'

const TAIL_BORDERS: Record<Side, string> = {
  right: 'border-b border-l',
  left: 'border-t border-r',
  below: 'border-t border-l',
  above: 'border-b border-r'
}

/**
 * Where the tail of a bubble goes: on the edge that faces what the bubble is
 * attached to, `offset` px along it, with the borders of the two sides that
 * show once the square it is made of is turned.
 */
export function bubbleTail(
  side: Side,
  offset: number
): { classes: string; style: { left: string; top: string } } {
  const at = `${offset}px`
  const style = {
    right: { left: '0', top: at },
    left: { left: '100%', top: at },
    below: { left: at, top: '0' },
    above: { left: at, top: '100%' }
  }[side]
  return { classes: TAIL_BORDERS[side], style }
}
