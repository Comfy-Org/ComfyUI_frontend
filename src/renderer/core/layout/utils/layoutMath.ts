import type { Bounds, NodeLayout, Point } from '@/renderer/core/layout/types'

export const REROUTE_RADIUS = 8

export function pointInBounds(point: Point, bounds: Bounds): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  )
}

export function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  )
}

function segmentTouchesBounds(a: Point, b: Point, bounds: Bounds): boolean {
  if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) return false
  const left = bounds.x
  const right = bounds.x + bounds.width
  const top = bounds.y
  const bottom = bounds.y + bounds.height
  let tMin = 0
  let tMax = 1
  const dx = b.x - a.x
  const dy = b.y - a.y
  const clips: [number, number][] = [
    [-dx, a.x - left],
    [dx, right - a.x],
    [-dy, a.y - top],
    [dy, bottom - a.y]
  ]
  for (const [p, q] of clips) {
    if (p === 0) {
      if (q < 0) return false
      continue
    }
    const t = q / p
    if (p < 0) tMin = Math.max(tMin, t)
    else tMax = Math.min(tMax, t)
    if (tMin > tMax) return false
  }
  return true
}

export function polylineIntersectsBounds(
  points: readonly Point[],
  bounds: Bounds
): boolean {
  for (let i = 1; i < points.length; i++) {
    if (segmentTouchesBounds(points[i - 1], points[i], bounds)) return true
  }
  return false
}

export function calculateBounds(nodes: NodeLayout[]): Bounds {
  let minX = Infinity,
    minY = Infinity
  let maxX = -Infinity,
    maxY = -Infinity

  for (const node of nodes) {
    const bounds = node.bounds
    minX = Math.min(minX, bounds.x)
    minY = Math.min(minY, bounds.y)
    maxX = Math.max(maxX, bounds.x + bounds.width)
    maxY = Math.max(maxY, bounds.y + bounds.height)
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  }
}
