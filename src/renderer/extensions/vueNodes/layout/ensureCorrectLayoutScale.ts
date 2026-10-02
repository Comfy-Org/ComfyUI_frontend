import type { LGraph, RendererType } from '@/lib/litegraph/src/LGraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { snapPoint } from '@/lib/litegraph/src/measure'
import type { Point as LGPoint } from '@/lib/litegraph/src/interfaces'
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
 *   graph metadata is missing, this value is used as a fallback.
 * @param targetGraph - The graph to normalize.
 */
export function ensureCorrectLayoutScale(
  rendererVersion: RendererType | undefined,
  graph: LGraph
): boolean {
  const currentRenderer = graph.extra.workflowRendererVersion
  if (currentRenderer === 'Vue-corrected') return false

  const renderer = currentRenderer ?? rendererVersion
  if (renderer !== 'Vue') return false

  const anchor = getGraphRenderAnchor(graph)

  function applySnap(
    pos: [number, number],
    method: 'round' | 'ceil' | 'floor' = 'round'
  ) {
    if (LiteGraph.alwaysSnapToGrid) {
      const snapTo = graph.getSnapToGridSize()
      if (snapTo) {
        snapPoint(pos, snapTo, method)
      }
    }
  }

  function normalizedBounds(
    item: Positioned
  ): [x: number, y: number, width: number, height: number] {
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
    const pos: [number, number] = [c.x, c.y]
    const size: [number, number] = [c.width, c.height]
    applySnap(pos)
    applySnap(size, 'ceil')

    return [pos[0], pos[1], size[0], size[1]]
  }

  function normalize(item: Positioned) {
    const [x, y, width, height] = normalizedBounds(item)
    item.pos = [x, y]
    item.size = [width, height]
  }

  for (const node of graph.nodes) {
    normalize(node)
  }

  for (const reroute of graph.reroutes.values()) {
    const p = unprojectPoint(
      { x: reroute.pos[0], y: reroute.pos[1] },
      anchor,
      RENDER_SCALE_FACTOR
    )
    const pos: [number, number] = [p.x, p.y]
    applySnap(pos)
    reroute.pos = pos
  }

  for (const group of graph.groups) {
    group.boundingRect.set(normalizedBounds(group))
  }

  if ('inputNode' in graph && 'outputNode' in graph) {
    for (const ioNode of [
      graph.inputNode as SubgraphInputNode | null,
      graph.outputNode as SubgraphOutputNode | null
    ]) {
      if (ioNode) normalize(ioNode)
    }
  }

  graph.extra.workflowRendererVersion = 'Vue-corrected'
  return true
}
