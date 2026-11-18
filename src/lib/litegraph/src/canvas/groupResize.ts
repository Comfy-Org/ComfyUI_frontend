import type {
  Bounds,
  CompassCorners,
  ReadOnlyRect
} from '@comfyorg/shared-frontend-utils/geometry'

const CORNER_REACH = 10

/** Returns the corner of `rect` whose resize handle contains the point, if any. */
export function resizeCornerAt(
  [left, top, width, height]: ReadOnlyRect,
  x: number,
  y: number
): CompassCorners | undefined {
  const right = left + width
  const bottom = top + height
  if (x < left || x > right || y < top || y > bottom) return

  const reach = Math.min(CORNER_REACH, width / 4, height / 4)
  const west = x - left < reach
  const east = right - x < reach
  const north = y - top < reach
  const south = bottom - y < reach
  const nearX = west ? x - left : right - x
  const nearY = north ? y - top : bottom - y
  if (!(west || east) || !(north || south) || nearX + nearY > reach) return

  if (north) return west ? 'NW' : 'NE'
  return west ? 'SW' : 'SE'
}

/** Resizes `start` by dragging `corner` by a delta, keeping the opposite corner fixed. */
export function resizeFromCorner(
  [x, y, width, height]: ReadOnlyRect,
  corner: CompassCorners,
  deltaX: number,
  deltaY: number
): [x: number, y: number, width: number, height: number] {
  const west = corner.includes('W')
  const north = corner.includes('N')
  return [
    west ? x + deltaX : x,
    north ? y + deltaY : y,
    west ? width - deltaX : width + deltaX,
    north ? height - deltaY : height + deltaY
  ]
}

/** Grows `box` to the minimum size, keeping the edges opposite `corner` in place. */
export function clampToMinimum<T extends Bounds>(
  box: T,
  corner: CompassCorners,
  minWidth: number,
  minHeight: number
): T {
  const width = Math.max(box.width, minWidth)
  const height = Math.max(box.height, minHeight)
  return {
    ...box,
    x: corner.includes('W') ? box.x + box.width - width : box.x,
    y: corner.includes('N') ? box.y + box.height - height : box.y,
    width,
    height
  }
}
