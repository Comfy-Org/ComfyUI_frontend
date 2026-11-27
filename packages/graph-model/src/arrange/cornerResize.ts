import type {
  Bounds,
  CompassCorners,
  Point2D,
  ReadOnlyRect,
  Size2D
} from '@comfyorg/shared-frontend-utils/geometry'

type Rounding = 'round' | 'ceil'

function snapTo(value: number, grid: number, rounding: Rounding = 'round') {
  return grid * Math[rounding](value / grid)
}

export const GROUP_RESIZE_REACH = 10

/** Returns the corner of `rect` whose resize handle contains the point, if any. */
export function resizeCornerAt(
  [left, top, width, height]: ReadOnlyRect,
  x: number,
  y: number
): CompassCorners | undefined {
  const right = left + width
  const bottom = top + height
  if (x < left || x > right || y < top || y > bottom) return

  const depth = Math.min(GROUP_RESIZE_REACH, width / 4, height / 4)
  const west = x - left < depth
  const east = right - x < depth
  const north = y - top < depth
  const south = bottom - y < depth
  const nearX = west ? x - left : right - x
  const nearY = north ? y - top : bottom - y
  if (!(west || east) || !(north || south) || nearX + nearY > depth) return

  if (north) return west ? 'NW' : 'NE'
  return west ? 'SW' : 'SE'
}

/** True for corners on the left edge (SW, NW), which move the x-origin when dragged. */
export function hasWestEdge(corner: CompassCorners): boolean {
  return corner === 'SW' || corner === 'NW'
}

/** True for corners on the top edge (NE, NW), which move the y-origin when dragged. */
export function hasNorthEdge(corner: CompassCorners): boolean {
  return corner === 'NE' || corner === 'NW'
}

/** Resizes `start` by dragging `corner`, keeping the opposite corner fixed; with a grid, snaps a dragged west or north edge to the grid and rounds a dragged east or south size. */
export function resizeFromCorner(
  start: Bounds,
  corner: CompassCorners,
  deltaX: number,
  deltaY: number,
  grid = 0,
  sizeRounding: Rounding = 'round'
): Bounds {
  const west = hasWestEdge(corner)
  const north = hasNorthEdge(corner)
  const x = west ? start.x + deltaX : start.x
  const y = north ? start.y + deltaY : start.y
  const width = start.width + (west ? -deltaX : deltaX)
  const height = start.height + (north ? -deltaY : deltaY)
  if (!grid) return { x, y, width, height }

  const edgeX = snapTo(x, grid)
  const edgeY = snapTo(y, grid)
  return {
    x: west ? edgeX : x,
    y: north ? edgeY : y,
    width: west
      ? start.x + start.width - edgeX
      : snapTo(width, grid, sizeRounding),
    height: north
      ? start.y + start.height - edgeY
      : snapTo(height, grid, sizeRounding)
  }
}

/** Grows `box` to the minimum size, keeping the edges opposite `corner` in place. */
export function clampToMinimum(
  box: Bounds,
  corner: CompassCorners,
  minWidth: number,
  minHeight: number
): Bounds {
  const width = Math.max(box.width, minWidth)
  const height = Math.max(box.height, minHeight)
  return {
    x: hasWestEdge(corner) ? box.x + box.width - width : box.x,
    y: hasNorthEdge(corner) ? box.y + box.height - height : box.y,
    width,
    height
  }
}

export interface ResizeBoxOptions {
  /** The minimum size at a given width, for content that reflows. */
  minAt: (width: number) => Size2D
  grid?: number
  sizeRounding?: Rounding
  /** Snaps the resized box, honouring `min`; omit to leave it unsnapped. */
  snap?: (box: Bounds, min: Size2D) => Bounds
}

/** Resizes `start` by dragging `corner` by `delta`: grid, then snap, then the minimum size, keeping the opposite edges fixed. */
export function resizeBox(
  start: Bounds,
  corner: CompassCorners,
  delta: Point2D,
  { grid = 0, sizeRounding, minAt, snap }: ResizeBoxOptions
): Bounds {
  const resized = resizeFromCorner(
    start,
    corner,
    delta.x,
    delta.y,
    grid,
    sizeRounding
  )
  const min = minAt(resized.width)
  const snapped = snap?.(resized, min) ?? resized
  const { width, height } =
    snapped.width === resized.width ? min : minAt(snapped.width)
  return clampToMinimum(snapped, corner, width, height)
}
