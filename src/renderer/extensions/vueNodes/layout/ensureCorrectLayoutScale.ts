import type { LGraph, RendererType } from '@/lib/litegraph/src/LGraph'
import type { Point as LGPoint } from '@/lib/litegraph/src/interfaces'
import type { Point } from '@/renderer/core/layout/types'
import {
  RENDER_SCALE_FACTOR,
  getGraphRenderAnchor,
  unprojectBounds,
  unprojectPoint
} from '@/renderer/core/layout/transform/graphRenderTransform'
import type { SubgraphInputNode } from '@/lib/litegraph/src/subgraph/SubgraphInputNode'
import type { SubgraphOutputNode } from '@/lib/litegraph/src/subgraph/SubgraphOutputNode'

interface Positioned {
  pos: LGPoint
  size: LGPoint
}

function unprojectPosSize(item: Positioned, anchor: Point) {
  const c = unprojectBounds(
    {
      x: item.pos[0],
      y: item.pos[1],
      width: item.size[0],
      height: item.size[1]
    },
    anchor,
    RENDER_SCALE_FACTOR
  )
  item.pos = [c.x, c.y]
  item.size = [c.width, c.height]
}

/**
 * One-time legacy normalizer for workflows saved with Vue-scaled coordinates.
 *
 * Detects workflows saved in the old Vue coordinate space (where positions
 * were mutated by 1.2x at runtime) and normalizes them back to canonical
 * LiteGraph coordinates. Runs once per graph, then marks it as normalized.
 *
 * After normalization, rendering applies the 1.2x scale visually via CSS
 * transforms rather than mutating persisted geometry.
 *
 * @param rendererVersion - Override for the renderer version check. When
 *   provided, this value is used instead of the graph's own
 *   `workflowRendererVersion` (useful when the graph's metadata has already
 *   been cleared or when using a parent graph's version as fallback).
 * @param targetGraph - The graph to normalize.
 */
export function ensureCorrectLayoutScale(
  rendererVersion: RendererType | undefined,
  graph: LGraph
): boolean {
  if (!graph.nodes) return false

  const renderer = rendererVersion ?? graph.extra.workflowRendererVersion
  if (renderer !== 'Vue') return false

  const anchor = getGraphRenderAnchor(graph)

  for (const node of graph.nodes) {
    const c = unprojectBounds(
      {
        x: node.pos[0],
        y: node.pos[1],
        width: node.size[0],
        height: node.size[1]
      },
      anchor,
      RENDER_SCALE_FACTOR
    )
    node.pos[0] = c.x
    node.pos[1] = c.y
    node.size[0] = c.width
    node.size[1] = c.height
  }

  for (const reroute of graph.reroutes.values()) {
    const p = unprojectPoint(
      { x: reroute.pos[0], y: reroute.pos[1] },
      anchor,
      RENDER_SCALE_FACTOR
    )
    reroute.pos = [p.x, p.y]
  }

  for (const group of graph.groups) {
    unprojectPosSize(group, anchor)
  }

  if ('inputNode' in graph && 'outputNode' in graph) {
    for (const ioNode of [
      graph.inputNode as SubgraphInputNode,
      graph.outputNode as SubgraphOutputNode
    ]) {
      unprojectPosSize(ioNode, anchor)
    }
  }

  graph.extra.workflowRendererVersion = 'Vue-corrected'
  return true
}
