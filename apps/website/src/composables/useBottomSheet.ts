// Where a sheet dragged by its handle comes to rest, as a share of the screen:
// the height it opens at, the height a pull upwards gives it, and the point
// below which letting go means putting it away rather than making it smaller.
const COLLAPSED = 0.62
const EXPANDED = 0.92
const DISMISS = 0.34

export type SheetRest = 'closed' | 'collapsed' | 'expanded'

export function restAt(fraction: number): SheetRest {
  if (fraction < DISMISS) return 'closed'
  return fraction < (COLLAPSED + EXPANDED) / 2 ? 'collapsed' : 'expanded'
}

export function heightAt(
  rest: Exclude<SheetRest, 'closed'>,
  viewport: number
): number {
  return Math.round((rest === 'expanded' ? EXPANDED : COLLAPSED) * viewport)
}
