import type { LinkSegment } from '@/lib/litegraph/src/interfaces'
import type { Point } from '@/renderer/core/layout/types'

interface LazyPolyline {
  compute: () => readonly Point[]
  points?: readonly Point[]
}

const polylines = new WeakMap<LinkSegment, LazyPolyline>()

export function setLinkPolyline(
  segment: LinkSegment,
  compute: () => readonly Point[]
) {
  polylines.set(segment, { compute })
}

export function getLinkPolyline(
  segment: LinkSegment
): readonly Point[] | undefined {
  const polyline = polylines.get(segment)
  if (!polyline) return undefined
  polyline.points ??= polyline.compute()
  return polyline.points
}
