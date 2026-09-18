import log from 'loglevel'

import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { compareNodeIds } from '@/types/nodeId'

const logger = log.getLogger('arrangeForLegacyRender')

interface RenderOrderCacheEntry {
  graphVersion: number
  layoutVersion: number
  nodes: LGraphNode[]
}

const renderOrderCache = new WeakMap<LGraph, RenderOrderCacheEntry>()

export function nodesInRenderOrder(graph: LGraph): LGraphNode[] {
  const layoutVersion = layoutStore.layoutVersion
  const cached = renderOrderCache.get(graph)
  if (
    cached &&
    cached.graphVersion === graph._version &&
    cached.layoutVersion === layoutVersion
  )
    return cached.nodes

  const rootGraphId = graph.rootGraph.id
  const nodes = graph._nodes
    .map((node) => ({
      node,
      zIndex: layoutStore.getNodeLayout(rootGraphId, node.id)?.zIndex ?? 0
    }))
    .sort((a, b) => a.zIndex - b.zIndex || compareNodeIds(a.node.id, b.node.id))
    .map(({ node }) => node)
  renderOrderCache.set(graph, {
    graphVersion: graph._version,
    layoutVersion,
    nodes
  })
  return nodes
}

/**
 * `drawConnections` normally arranges slots, but Vue-mode `drawNode` clears
 * `_widgetSlotsDirty`, so that pass is skipped after switching to legacy mode.
 * Vue DOM measurements also differ slightly from legacy slot positions.
 *
 * Delete when `getSlotPosition` is consistent across both renderers.
 */
export function arrangeForLegacyRender(graph: LGraph): void {
  for (const node of graph._nodes) {
    if (node.flags.collapsed) continue
    try {
      node.arrange()
    } catch (error) {
      logger.warn('Skipping node that could not be arranged:', node.id, error)
    }
  }
}
