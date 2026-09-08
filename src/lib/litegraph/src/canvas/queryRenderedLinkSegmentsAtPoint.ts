import { layoutStore } from '@/renderer/core/layout/store/layoutStore'

import type { LGraphCanvas } from '../LGraphCanvas'
import { Reroute } from '../Reroute'
import type { LinkSegment } from '../interfaces'

export function queryRenderedLinkSegmentsAtPoint(
  canvas: LGraphCanvas,
  x: number,
  y: number
): ReadonlySet<LinkSegment> {
  const { ctx, renderedPaths } = canvas
  const { lineWidth } = ctx
  const hits = new Set<LinkSegment>()
  ctx.lineWidth = canvas.connections_width + 7
  try {
    const layoutHit = layoutStore.queryLinkSegmentAtPoint({ x, y }, ctx)
    const dpi = Math.max(window.devicePixelRatio, 1)
    for (const segment of renderedPaths) {
      const layoutId =
        segment instanceof Reroute ? layoutHit?.rerouteId : layoutHit?.linkId
      if (
        segment.id === layoutId ||
        (segment.path && ctx.isPointInStroke(segment.path, x * dpi, y * dpi))
      ) {
        hits.add(segment)
      }
    }
    return hits
  } finally {
    ctx.lineWidth = lineWidth
  }
}
