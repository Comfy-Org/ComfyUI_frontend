import type { Point, ReadOnlyPoint, ReadOnlyRect } from './interfaces'
import { LinkDirection } from './types/globalEnums'

/**
 * Calculates the distance between two points (2D vector)
 * @param a Point a as `x, y`
 * @param b Point b as `x, y`
 * @returns Distance between point {@link a} & {@link b}
 */
export function distance(a: ReadOnlyPoint, b: ReadOnlyPoint): number {
  return Math.sqrt(
    (b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1])
  )
}

/**
 * Calculates the distance2 (squared) between two points (2D vector).
 * Much faster when only comparing distances (closest/furthest point).
 * @param a Point a as `x, y`
 * @param b Point b as `x, y`
 * @returns Distance2 (squared) between point {@link a} & {@link b}
 */
export function dist2(a: ReadOnlyPoint, b: ReadOnlyPoint): number {
  return (
    (b[0] - a[0]) * (b[0] - a[0])) + ((b[1] - a[1]) * (b[1] - a[1])
  )
}

/**
 * Determines whether a point is inside a rectangle.
 * @param point The point to check, as `x, y`
 * @param rect The rectangle, as `x, y, width, height`
 * @returns `true` if the point is inside the rect, otherwise `false`
 */
export function isPointInRectangle(point: ReadOnlyPoint, rect: ReadOnlyRect): boolean {
  return (
    rect[0] < point[0] &&
    rect[0] + rect[2] > point[0] &&
    rect[1] < point[1] &&
    rect[1] + rect[3] > point[1]
  )
}

/**
 * Determines whether a point is inside a rectangle.
 * @param x Point x
 * @param y Point y
 * @param left Rect x
 * @param top Rect y
 * @param width Rect width
 * @param height Rect height
 * @returns `true` if the point is inside the rect, otherwise `false`
 */
export function isInsideRectangle(x: number, y: number, left: number, top: number, width: number, height: number): boolean {
  return left < x && left + width > x && top < y && top + height > y
}

/**
 * Cheap, low accuracy check to determine if a point is roughly inside a sort-of octagon
 * @param x Point x
 * @param y Point y
 * @param radius Radius to use as rough guide for octagon
 * @returns `true` if the point is roughly inside the octagon centred on 0,0 with specified radius
 */
export function isSortaInsideOctagon(x: number, y: number, radius: number): boolean {
  const sum = Math.min(radius, Math.abs(x)) + Math.min(radius, Math.abs(y))
  return sum < radius * 0.75
}

/**
 * Determines if two rectangles have any overlap
 * @param a Rectangle A as `x, y, width, height`
 * @param b Rectangle B as `x, y, width, height`
 * @returns `true` if rectangles overlap, otherwise `false`
 */
export function overlapBounding(a: ReadOnlyRect, b: ReadOnlyRect): boolean {
  const aRight = a[0] + a[2]
  const aBottom = a[1] + a[3]
  const bRight = b[0] + b[2]
  const bBottom = b[1] + b[3]

  return (
    a[0] > bRight ||
    a[1] > bBottom ||
    aRight < b[0] ||
    aBottom < b[1]
  ) ? false : true
}

/**
 * Determines if rectangle {@link a} contains the centre point of rectangle {@link b}.
 * @param a Container rectangle A as `x, y, width, height`
 * @param b Sub-rectangle B as `x, y, width, height`
 * @returns `true` if {@link a} contains most of {@link b}, otherwise `false`
 */
export function containsCentre(a: ReadOnlyRect, b: ReadOnlyRect): boolean {
  const centreX = b[0] + (b[2] * 0.5)
  const centreY = b[1] + (b[3] * 0.5)
  return isInsideRectangle(centreX, centreY, a[0], a[1], a[2], a[3])
}

/**
 * Determines if rectangle {@link a} wholly contains rectangle {@link b}.
 * @param a Container rectangle A as `x, y, width, height`
 * @param b Sub-rectangle B as `x, y, width, height`
 * @returns `true` if {@link a} wholly contains {@link b}, otherwise `false`
 */
export function containsRect(a: ReadOnlyRect, b: ReadOnlyRect): boolean {
  const aRight = a[0] + a[2]
  const aBottom = a[1] + a[3]
  const bRight = b[0] + b[2]
  const bBottom = b[1] + b[3]

  return (
    a[0] < b[0] &&
    a[1] < b[1] &&
    aRight > bRight &&
    aBottom > bBottom
  )
}

/**
 * Adds an offset in the specified direction to {@link out}
 * @param amount Amount of offset to add
 * @param direction Direction to add the offset to
 * @param out The {@link Point} to add the offset to
 */
export function addDirectionalOffset(amount: number, direction: LinkDirection, out: Point): void {
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

/**
 * Rotates an offset in 90° increments.
 *
 * Swaps/flips axis values of a 2D vector offset - effectively rotating {@link offset} by 90°
 * @param offset The zero-based offset to rotate
 * @param from Direction to rotate from
 * @param to Direction to rotate to
 */
export function rotateLink(offset: Point, from: LinkDirection, to: LinkDirection): void {
  let x: number
  let y: number

  // Normalise to left
  switch (from) {
    case to:
    case LinkDirection.CENTER:
    case LinkDirection.NONE:
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

/**
 * Check if a point is to to the left or right of a line.
 * Project a line from lineStart -> lineEnd.  Determine if point is to the left or right of that projection.
 * {@link https://www.geeksforgeeks.org/orientation-3-ordered-points/}
 * @param lineStart The start point of the line
 * @param lineEnd The end point of the line
 * @param point The point to check
 * @returns 0 if all three points are in a straight line, a negative value if point is to the left of the projected line, or positive if the point is to the right
 */
export function getOrientation(lineStart: ReadOnlyPoint, lineEnd: ReadOnlyPoint, x: number, y: number): number {
  return (
    (lineEnd[1] - lineStart[1]) * (x - lineEnd[0])) - ((lineEnd[0] - lineStart[0]) * (y - lineEnd[1])
  )
}

/**
 *
 * @param out The array to store the point in
 * @param a Start point
 * @param b End point
 * @param controlA Start curve control point
 * @param controlB End curve control point
 * @param t Time: factor of distance to travel along the curve (e.g 0.25 is 25% along the curve)
 */
export function findPointOnCurve(
  out: Point,
  a: ReadOnlyPoint,
  b: ReadOnlyPoint,
  controlA: ReadOnlyPoint,
  controlB: ReadOnlyPoint,
  t: number = 0.5
): void {
  const iT = 1 - t

  const c1 = iT * iT * iT
  const c2 = 3 * (iT * iT) * t
  const c3 = 3 * iT * (t * t)
  const c4 = t * t * t

  out[0] = (c1 * a[0]) + (c2 * controlA[0]) + (c3 * controlB[0]) + (c4 * b[0])
  out[1] = (c1 * a[1]) + (c2 * controlA[1]) + (c3 * controlB[1]) + (c4 * b[1])
}
