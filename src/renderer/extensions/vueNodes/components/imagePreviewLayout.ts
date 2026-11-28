import { clamp } from 'es-toolkit'

export const IMAGE_PREVIEW_CONTENT_MIN_HEIGHT = 220
export const IMAGE_PREVIEW_MARGIN_TOP = 8
export const NODE_CONTENT_GAP = 4
export const IMAGE_PREVIEW_HEIGHT_RESERVE =
  IMAGE_PREVIEW_CONTENT_MIN_HEIGHT + IMAGE_PREVIEW_MARGIN_TOP + NODE_CONTENT_GAP

const GRID_FIT_MAX_HEIGHT_PER_WIDTH = 2
const GRID_COLUMN_BOUNDARY_MARGIN = 1

interface ImageGridShape {
  count: number
  width: number
  aspectRatio: number
}

/** The column count an image grid of this content size shows. */
export function imageGridColumns({
  count,
  width,
  height,
  aspectRatio
}: ImageGridShape & { height: number }) {
  return Math.max(
    Math.round(Math.sqrt((count * width) / height / aspectRatio)),
    1
  )
}

function heightKeepingColumns(
  { count, width, aspectRatio, gap }: ImageGridShape & { gap: number },
  columns: number
) {
  const rows = Math.ceil(count / columns)
  const cellHeight = (width - (columns - 1) * gap) / columns / aspectRatio
  const heightAtColumnBoundary = (boundary: number) =>
    (count * width) / aspectRatio / boundary ** 2
  return clamp(
    rows * cellHeight + (rows - 1) * gap,
    heightAtColumnBoundary(columns + 0.5) + GRID_COLUMN_BOUNDARY_MARGIN,
    heightAtColumnBoundary(columns - 0.5) - GRID_COLUMN_BOUNDARY_MARGIN
  )
}

type ImageGridFit = ImageGridShape & {
  columns: number
  gap: number
  minHeight: number
}

function heightSettlingColumns(
  grid: ImageGridFit,
  maxHeight: number,
  columns: number,
  attempts: number
): number {
  const height = clamp(
    heightKeepingColumns(grid, columns),
    grid.minHeight,
    maxHeight
  )
  const shown = imageGridColumns({ ...grid, height })
  return shown === columns || attempts === 0
    ? height
    : heightSettlingColumns(grid, maxHeight, shown, attempts - 1)
}

/** The content height that shows every thumbnail of an image grid uncropped at its width, keeping its column count where possible, between `minHeight` and twice the width. */
export function fitImageGridHeight(grid: ImageGridFit) {
  return heightSettlingColumns(
    grid,
    Math.max(grid.minHeight, grid.width * GRID_FIT_MAX_HEIGHT_PER_WIDTH),
    Math.min(grid.columns, grid.count),
    2
  )
}
