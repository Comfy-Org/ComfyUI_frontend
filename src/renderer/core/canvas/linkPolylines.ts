import type { Point } from '@/renderer/core/canvas/pathRenderer'

const polylines = new WeakMap<object, readonly Point[]>()

/** Records the polyline last drawn for a link or reroute segment. */
export function setLinkPolyline(segment: object, polyline: readonly Point[]) {
  polylines.set(segment, polyline)
}

/** The polyline last drawn for a link or reroute segment, if any. */
export function getLinkPolyline(segment: object): readonly Point[] | undefined {
  return polylines.get(segment)
}
