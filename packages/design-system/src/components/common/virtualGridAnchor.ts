import { clamp } from 'es-toolkit'

type GridAnchor = { index: number; rowFraction: number; focusY: number }

/** Where the first row starts in the scroll content and the row-plus-gap pitch. */
type RowGeometry = { rowTop: number; rowPitch: number }

/** The item under `focus` (relative to the scroller's top-left), given the first track's left edge and the track-plus-gap stride, and how far into its row the focus sits. */
export function anchorAt(
  focus: { x: number; y: number },
  grid: RowGeometry & {
    scrollTop: number
    cols: number
    trackLeft: number
    stride: number
  }
): GridAnchor {
  const rows = (grid.scrollTop + focus.y - grid.rowTop) / grid.rowPitch
  const row = Math.max(0, Math.floor(rows))
  const col = clamp(
    Math.floor((focus.x - grid.trackLeft) / grid.stride),
    0,
    grid.cols - 1
  )
  return {
    index: row * grid.cols + col,
    rowFraction: Math.max(0, rows - row),
    focusY: focus.y
  }
}

/** The scroll offset that puts `anchor` back under its focus point after the grid reflows. */
export function scrollTopFor(
  anchor: GridAnchor,
  cols: number,
  { rowTop, rowPitch }: RowGeometry
): number {
  const row = Math.floor(anchor.index / cols)
  return Math.max(
    0,
    rowTop + (row + anchor.rowFraction) * rowPitch - anchor.focusY
  )
}
