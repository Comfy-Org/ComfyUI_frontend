import type { HasBoundingRect, Point, ReadOnlyRect, Rect } from './interfaces'
import { Alignment, LinkDirection, hasFlag } from './types/globalEnums'

export function distance(a: Readonly<Point>, b: Readonly<Point>): number {
  return Math.sqrt(
    (b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1])
  )
}

/** Squared distance — faster when only comparing distances. */
export function dist2(x1: number, y1: number, x2: number, y2: number): number {
  return (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)
}

/** Inclusive of top-left edge, unlike {@link isInsideRectangle}. */
export function isInRectangle(
  x: number,
  y: number,
  left: number,
  top: number,
  width: number,
  height: number
): boolean {
  return x >= left && x < left + width && y >= top && y < top + height
}

export function isPointInRect(
  point: Readonly<Point>,
  rect: ReadOnlyRect
): boolean {
  return (
    point[0] >= rect[0] &&
    point[0] < rect[0] + rect[2] &&
    point[1] >= rect[1] &&
    point[1] < rect[1] + rect[3]
  )
}

export function isInRect(x: number, y: number, rect: ReadOnlyRect): boolean {
  return (
    x >= rect[0] &&
    x < rect[0] + rect[2] &&
    y >= rect[1] &&
    y < rect[1] + rect[3]
  )
}

/** @deprecated Use {@link isInRectangle} — this excludes the top-left edge. */
export function isInsideRectangle(
  x: number,
  y: number,
  left: number,
  top: number,
  width: number,
  height: number
): boolean {
  return left < x && left + width > x && top < y && top + height > y
}

export function overlapBounding(a: ReadOnlyRect, b: ReadOnlyRect): boolean {
  const aRight = a[0] + a[2]
  const aBottom = a[1] + a[3]
  const bRight = b[0] + b[2]
  const bBottom = b[1] + b[3]

  return a[0] > bRight || a[1] > bBottom || aRight < b[0] || aBottom < b[1]
    ? false
    : true
}

export function getCentre(rect: ReadOnlyRect): Point {
  return [rect[0] + rect[2] * 0.5, rect[1] + rect[3] * 0.5]
}

export function containsCentre(a: ReadOnlyRect, b: ReadOnlyRect): boolean {
  const centreX = b[0] + b[2] * 0.5
  const centreY = b[1] + b[3] * 0.5
  return isInRect(centreX, centreY, a)
}

export function containsRect(a: ReadOnlyRect, b: ReadOnlyRect): boolean {
  const aRight = a[0] + a[2]
  const aBottom = a[1] + a[3]
  const bRight = b[0] + b[2]
  const bBottom = b[1] + b[3]

  const identical =
    a[0] === b[0] && a[1] === b[1] && aRight === bRight && aBottom === bBottom

  return (
    !identical &&
    a[0] <= b[0] &&
    a[1] <= b[1] &&
    aRight >= bRight &&
    aBottom >= bBottom
  )
}

export function addDirectionalOffset(
  amount: number,
  direction: LinkDirection,
  out: Point
): void {
  switch (direction) {
    case LinkDirection.LEFT:
      out[0] -= amount
      return
    case LinkDirection.RIGHT:
      out[0] += amount
      return
    case LinkDirection.UP:
      out[1] -= amount
      return
    case LinkDirection.DOWN:
      out[1] += amount
      return
    // LinkDirection.CENTER: Nothing to do.
  }
}

/** Rotates a 2D offset by swapping/flipping axes in 90° increments. */
export function rotateLink(
  offset: Point,
  from: LinkDirection,
  to: LinkDirection
): void {
  let x: number
  let y: number

  // Normalise to left
  switch (from) {
    case to:
    case LinkDirection.CENTER:
    case LinkDirection.NONE:
    default:
      // Nothing to do
      return

    case LinkDirection.LEFT:
      x = offset[0]
      y = offset[1]
      break
    case LinkDirection.RIGHT:
      x = -offset[0]
      y = -offset[1]
      break
    case LinkDirection.UP:
      x = -offset[1]
      y = offset[0]
      break
    case LinkDirection.DOWN:
      x = offset[1]
      y = -offset[0]
      break
  }

  // Apply new direction
  switch (to) {
    case LinkDirection.CENTER:
    case LinkDirection.NONE:
      // Nothing to do
      return

    case LinkDirection.LEFT:
      offset[0] = x
      offset[1] = y
      break
    case LinkDirection.RIGHT:
      offset[0] = -x
      offset[1] = -y
      break
    case LinkDirection.UP:
      offset[0] = y
      offset[1] = -x
      break
    case LinkDirection.DOWN:
      offset[0] = -y
      offset[1] = x
      break
  }
}

/** Returns <0 if point is left of line, >0 if right, 0 if collinear. */
export function getOrientation(
  lineStart: Readonly<Point>,
  lineEnd: Readonly<Point>,
  x: number,
  y: number
): number {
  return (
    (lineEnd[1] - lineStart[1]) * (x - lineEnd[0]) -
    (lineEnd[0] - lineStart[0]) * (y - lineEnd[1])
  )
}

/** Cubic bezier interpolation at parameter t (0..1). */
export function findPointOnCurve(
  out: Point,
  a: Readonly<Point>,
  b: Readonly<Point>,
  controlA: Readonly<Point>,
  controlB: Readonly<Point>,
  t: number = 0.5
): void {
  const iT = 1 - t

  const c1 = iT * iT * iT
  const c2 = 3 * (iT * iT) * t
  const c3 = 3 * iT * (t * t)
  const c4 = t * t * t

  out[0] = c1 * a[0] + c2 * controlA[0] + c3 * controlB[0] + c4 * b[0]
  out[1] = c1 * a[1] + c2 * controlA[1] + c3 * controlB[1] + c4 * b[1]
}

export function createBounds(
  objects: Iterable<HasBoundingRect>,
  padding: number = 10
): ReadOnlyRect | null {
  const bounds: Rect = [Infinity, Infinity, -Infinity, -Infinity]

  for (const obj of objects) {
    const rect = obj.boundingRect
    bounds[0] = Math.min(bounds[0], rect[0])
    bounds[1] = Math.min(bounds[1], rect[1])
    bounds[2] = Math.max(bounds[2], rect[0] + rect[2])
    bounds[3] = Math.max(bounds[3], rect[1] + rect[3])
  }
  if (!bounds.every((x) => isFinite(x))) return null

  return [
    bounds[0] - padding,
    bounds[1] - padding,
    bounds[2] - bounds[0] + 2 * padding,
    bounds[3] - bounds[1] + 2 * padding
  ]
}

export function snapPoint(pos: Point | Rect, snapTo: number): boolean {
  if (!snapTo) return false

  pos[0] = snapTo * Math.round(pos[0] / snapTo)
  pos[1] = snapTo * Math.round(pos[1] / snapTo)
  return true
}

/**
 * Aligns a {@link Rect} relative to the edges or centre of a {@link container} rectangle.
 *
 * With no {@link inset}, the element will be placed on the interior of the {@link container},
 * with their edges lined up on the {@link anchors}.  A positive {@link inset} moves the element towards the centre,
 * negative will push it outside the {@link container}.
 * @param rect The bounding rect of the element to align.
 * If using the element's pos/size backing store, this function will move the element.
 * @param anchors The direction(s) to anchor the element to
 * @param container The rectangle inside which to align the element
 * @param inset Relative offset from each {@link anchors} edge, with positive always leading to the centre, as an `[x, y]` point
 * @returns The original {@link rect}, modified in place.
 */
export function alignToContainer(
  rect: Rect,
  anchors: Alignment,
  [containerX, containerY, containerWidth, containerHeight]: ReadOnlyRect,
  [insetX, insetY]: Readonly<Point> = [0, 0]
): Rect {
  if (hasFlag(anchors, Alignment.Left)) {
    // Left
    rect[0] = containerX + insetX
  } else if (hasFlag(anchors, Alignment.Right)) {
    // Right
    rect[0] = containerX + containerWidth - insetX - rect[2]
  } else if (hasFlag(anchors, Alignment.Centre)) {
    // Horizontal centre
    rect[0] = containerX + containerWidth * 0.5 - rect[2] * 0.5
  }

  if (hasFlag(anchors, Alignment.Top)) {
    // Top
    rect[1] = containerY + insetY
  } else if (hasFlag(anchors, Alignment.Bottom)) {
    // Bottom
    rect[1] = containerY + containerHeight - insetY - rect[3]
  } else if (hasFlag(anchors, Alignment.Middle)) {
    // Vertical middle
    rect[1] = containerY + containerHeight * 0.5 - rect[3] * 0.5
  }
  return rect
}

/**
 * Aligns a {@link Rect} relative to the edges of {@link other}.
 *
 * With no {@link outset}, the element will be placed on the exterior of the {@link other},
 * with their edges lined up on the {@link anchors}.  A positive {@link outset} moves the element away from the {@link other},
 * negative will push it inside the {@link other}.
 * @param rect The bounding rect of the element to align.
 * If using the element's pos/size backing store, this function will move the element.
 * @param anchors The direction(s) to anchor the element to
 * @param other The rectangle to align {@link rect} to
 * @param outset Relative offset from each {@link anchors} edge, with positive always moving away from the centre of the {@link other}, as an `[x, y]` point
 * @returns The original {@link rect}, modified in place.
 */
export function alignOutsideContainer(
  rect: Rect,
  anchors: Alignment,
  [otherX, otherY, otherWidth, otherHeight]: ReadOnlyRect,
  [outsetX, outsetY]: Readonly<Point> = [0, 0]
): Rect {
  if (hasFlag(anchors, Alignment.Left)) {
    // Left
    rect[0] = otherX - outsetX - rect[2]
  } else if (hasFlag(anchors, Alignment.Right)) {
    // Right
    rect[0] = otherX + otherWidth + outsetX
  } else if (hasFlag(anchors, Alignment.Centre)) {
    // Horizontal centre
    rect[0] = otherX + otherWidth * 0.5 - rect[2] * 0.5
  }

  if (hasFlag(anchors, Alignment.Top)) {
    // Top
    rect[1] = otherY - outsetY - rect[3]
  } else if (hasFlag(anchors, Alignment.Bottom)) {
    // Bottom
    rect[1] = otherY + otherHeight + outsetY
  } else if (hasFlag(anchors, Alignment.Middle)) {
    // Vertical middle
    rect[1] = otherY + otherHeight * 0.5 - rect[3] * 0.5
  }
  return rect
}
