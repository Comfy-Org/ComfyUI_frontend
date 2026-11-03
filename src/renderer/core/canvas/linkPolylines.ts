import type { LinkSegment } from '@comfyorg/graph-model/interfaces'
import type { Point2D as Point } from '@comfyorg/shared-frontend-utils/geometry'

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
