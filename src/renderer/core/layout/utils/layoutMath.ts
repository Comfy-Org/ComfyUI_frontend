import type {
  Bounds,
  LinkId,
  Point,
  RerouteId
} from '@/renderer/core/layout/types'

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

export function makeLinkSegmentKey(
  linkId: LinkId,
  rerouteId: RerouteId | null
): string {
  return `${linkId}:${rerouteId ?? 'final'}`
}
