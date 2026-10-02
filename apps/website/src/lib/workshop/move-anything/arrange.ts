/** A box in image space, each value a fraction of the image (0 to 1). */
export interface Rect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export interface MoveObject {
  readonly id: string
  readonly label: string
  /** Where the thing sits in the photo. */
  readonly from: Rect
  /** Where the visitor wants it. */
  readonly to: Rect
}

export type Corner = 'nw' | 'ne' | 'sw' | 'se'

export const MAX_OBJECTS = 4
export const MIN_SIZE = 0.03

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

/** Moves a box by a delta without letting it leave the image. */
export function moveRect(rect: Rect, dx: number, dy: number): Rect {
  return {
    ...rect,
    x: clamp(rect.x + dx, 0, 1 - rect.w),
    y: clamp(rect.y + dy, 0, 1 - rect.h)
  }
}

/** Drags one corner; the opposite corner stays put. */
export function resizeRect(
  rect: Rect,
  corner: Corner,
  dx: number,
  dy: number
): Rect {
  const left = corner === 'nw' || corner === 'sw'
  const top = corner === 'nw' || corner === 'ne'
  const x1 = left ? clamp(rect.x + dx, 0, rect.x + rect.w - MIN_SIZE) : rect.x
  const y1 = top ? clamp(rect.y + dy, 0, rect.y + rect.h - MIN_SIZE) : rect.y
  const x2 = left
    ? rect.x + rect.w
    : clamp(rect.x + rect.w + dx, rect.x + MIN_SIZE, 1)
  const y2 = top
    ? rect.y + rect.h
    : clamp(rect.y + rect.h + dy, rect.y + MIN_SIZE, 1)
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}

/** The box spanned by two points, kept inside the image. */
export function rectBetween(
  a: { x: number; y: number },
  b: { x: number; y: number }
): Rect {
  const x = clamp(Math.min(a.x, b.x), 0, 1)
  const y = clamp(Math.min(a.y, b.y), 0, 1)
  return {
    x,
    y,
    w: clamp(Math.max(a.x, b.x), 0, 1) - x,
    h: clamp(Math.max(a.y, b.y), 0, 1) - y
  }
}

export function isMoved(object: MoveObject): boolean {
  const { from, to } = object
  const near = (a: number, b: number) => Math.abs(a - b) < 0.002
  return !(
    near(from.x, to.x) &&
    near(from.y, to.y) &&
    near(from.w, to.w) &&
    near(from.h, to.h)
  )
}
