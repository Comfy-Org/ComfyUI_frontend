import type { Bounds, Point, Size } from '@/renderer/core/layout/types'

export function toPoint(x: number, y: number): Point {
  return { x, y }
}

export function isPointEqual(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y
}

export function isBoundsEqual(a: Bounds, b: Bounds): boolean {
  return (
    a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
  )
}

export function isBoundsObject(value: unknown): value is Bounds {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.x === 'number' &&
    typeof v.y === 'number' &&
    typeof v.width === 'number' &&
    typeof v.height === 'number'
  )
}

export function isSizeEqual(a: Size, b: Size): boolean {
  return a.width === b.width && a.height === b.height
}
