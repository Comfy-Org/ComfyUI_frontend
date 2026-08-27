import log from 'loglevel'

import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { compareNodeIds } from '@/types/nodeId'

const logger = log.getLogger('arrangeForLegacyRender')

export function nodesInRenderOrder(graph: LGraph): LGraphNode[] {
  const rootGraphId = graph.rootGraph.id
  return graph._nodes
    .map((node) => ({
      node,
      zIndex: layoutStore.getNodeLayout(rootGraphId, node.id)?.zIndex ?? 0
    }))
    .sort((a, b) => a.zIndex - b.zIndex || compareNodeIds(a.node.id, b.node.id))
    .map(({ node }) => node)
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
