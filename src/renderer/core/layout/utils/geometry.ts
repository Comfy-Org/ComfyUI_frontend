import type { Bounds, Point } from '@/renderer/core/layout/types'

export function samePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y
}

export function sameBounds(a: Bounds, b: Bounds): boolean {
  return (
    a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
  )
}
