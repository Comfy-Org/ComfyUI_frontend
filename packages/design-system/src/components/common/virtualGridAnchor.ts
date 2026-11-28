import { clamp } from 'es-toolkit'

type GridAnchor = { index: number; rowFraction: number; focusY: number }

/** The item under `focus` (relative to the scroller's top-left) and how far into its row the focus sits. */
export function anchorAt(
  focus: { x: number; y: number },
  grid: { scrollTop: number; rowHeight: number; cols: number; width: number }
): GridAnchor {
  const rows = (grid.scrollTop + focus.y) / grid.rowHeight
  const row = Math.floor(rows)
  const col = clamp(
    Math.floor(focus.x / (grid.width / grid.cols)),
    0,
    grid.cols - 1
  )
  return {
    index: row * grid.cols + col,
    rowFraction: rows - row,
    focusY: focus.y
  }
}

/** The scroll offset that puts `anchor` back under its focus point after the grid reflows. */
export function scrollTopFor(
  anchor: GridAnchor,
  cols: number,
  rowHeight: number
): number {
  const row = Math.floor(anchor.index / cols)
  return Math.max(0, (row + anchor.rowFraction) * rowHeight - anchor.focusY)
}
