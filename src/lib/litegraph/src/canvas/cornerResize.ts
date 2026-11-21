import type {
  Bounds,
  CompassCorners,
  PointTuple as Point,
  ReadOnlyRect
} from '@comfyorg/shared-frontend-utils/geometry'

import { snapPoint } from '@/lib/litegraph/src/measure'

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
export const hasWestEdge = (corner: CompassCorners): boolean =>
  corner === 'SW' || corner === 'NW'

/** True for corners on the top edge (NE, NW), which move the y-origin when dragged. */
export const hasNorthEdge = (corner: CompassCorners): boolean =>
  corner === 'NE' || corner === 'NW'

/** Resizes `start` by dragging `corner`, keeping the opposite corner fixed; with a grid, snaps a dragged west or north edge to the grid and rounds a dragged east or south size. */
export function resizeFromCorner(
  start: Bounds,
  corner: CompassCorners,
  deltaX: number,
  deltaY: number,
  grid = 0,
  sizeRounding: 'round' | 'ceil' = 'round'
): Bounds {
  const west = hasWestEdge(corner)
  const north = hasNorthEdge(corner)
  const x = west ? start.x + deltaX : start.x
  const y = north ? start.y + deltaY : start.y
  const width = start.width + (west ? -deltaX : deltaX)
  const height = start.height + (north ? -deltaY : deltaY)
  if (!grid) return { x, y, width, height }

  const edge: Point = [x, y]
  snapPoint(edge, grid)
  const size: Point = [width, height]
  snapPoint(size, grid, sizeRounding)
  return {
    x: west ? edge[0] : x,
    y: north ? edge[1] : y,
    width: west ? start.x + start.width - edge[0] : size[0],
    height: north ? start.y + start.height - edge[1] : size[1]
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
