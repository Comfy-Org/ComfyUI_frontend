import { layoutStore } from '@/renderer/core/layout/store/layoutStore'

import type { LGraph } from '../LGraph'
import type { Reroute } from '../Reroute'

/**
 * Resolves the reroute under a canvas-space point, preferring the layout store
 * and falling back to a geometric hit test over the reroutes on screen.
 */
export function findRerouteAtPoint(
  graph: LGraph,
  x: number,
  y: number,
  visibleReroutes: Iterable<Reroute>
): Reroute | undefined {
  const layoutHit = layoutStore.queryRerouteAtPoint(graph.rootGraph.id, {
    x,
    y
  })
  return (
    (layoutHit ? graph.getReroute(layoutHit.id) : undefined) ??
    graph.getRerouteOnPos(x, y, visibleReroutes)
  )
}
