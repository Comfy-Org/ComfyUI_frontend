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

function sample(polyline: LazyPolyline): readonly Point[] {
  polyline.points ??= polyline.compute()
  return polyline.points
}

export function getLinkPolyline(
  segment: LinkSegment
): readonly Point[] | undefined {
  const polyline = polylines.get(segment)
  return polyline && sample(polyline)
}

/** The segment's current polyline, sampled only when the returned function is called. */
export function deferLinkPolyline(
  segment: LinkSegment
): () => readonly Point[] {
  const polyline = polylines.get(segment)
  return () => (polyline ? sample(polyline) : [])
}
