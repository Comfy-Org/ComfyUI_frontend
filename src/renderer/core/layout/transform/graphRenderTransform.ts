import type { LGraph } from '@/lib/litegraph/src/LGraph'
import { createBounds } from '@/lib/litegraph/src/measure'
import type { Bounds, Point } from '@/renderer/core/layout/types'

export const RENDER_SCALE_FACTOR = 1.2

export const MIN_NODE_WIDTH = 225

const anchorCache = new WeakMap<LGraph, Point>()

/**
 * Returns a render anchor for a graph.
 *
 * @remarks
 * The anchor is computed once per graph instance and cached for that graph's
 * lifetime. This is intended for one-shot normalization passes.
 */
export function getGraphRenderAnchor(graph: LGraph): Point {
  const cached = anchorCache.get(graph)
  if (cached) return cached

  const bounds = graph.nodes?.length ? createBounds(graph.nodes) : undefined
  const anchor = bounds ? { x: bounds[0], y: bounds[1] } : { x: 0, y: 0 }
  anchorCache.set(graph, anchor)
  return anchor
}

export function unprojectPoint(
  point: Point,
  anchor: Point,
  scale: number
): Point {
  if (scale === 1) return point
  return {
    x: anchor.x + (point.x - anchor.x) / scale,
    y: anchor.y + (point.y - anchor.y) / scale
  }
}

export function unprojectBounds(
  bounds: Bounds,
  anchor: Point,
  scale: number
): Bounds {
  const topLeft = unprojectPoint({ x: bounds.x, y: bounds.y }, anchor, scale)
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: bounds.width / scale,
    height: bounds.height / scale
  }
}
