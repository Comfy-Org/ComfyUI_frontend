import { layoutStore } from '@/renderer/core/layout/store/layoutStore'

import type { LGraph } from '../LGraph'
import type { LinkSegment } from '../interfaces'
import type { LGraphCanvas } from '../LGraphCanvas'
import { Reroute } from '../Reroute'

/**
 * Resolves the reroute under a canvas-space point, preferring the layout store
 * and falling back to a geometric hit test over the reroutes on screen.
 */
export function findRerouteAtPoint(
  graph: LGraph,
  x: number,
  y: number,
  visibleReroutes: Iterable<Reroute>,
  renderedPaths: ReadonlySet<LinkSegment>
): Reroute | undefined {
  const layoutHit = layoutStore.queryRerouteAtPoint(graph.rootGraph.id, {
    x,
    y
  })
  const layoutReroute = layoutHit ? graph.getReroute(layoutHit.id) : undefined
  return (
    (layoutReroute && renderedPaths.has(layoutReroute)
      ? layoutReroute
      : undefined) ?? graph.getRerouteOnPos(x, y, visibleReroutes)
  )
}

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
