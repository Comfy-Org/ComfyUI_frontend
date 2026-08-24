import log from 'loglevel'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'

const logger = log.getLogger('arrangeForLegacyRender')

/**
 * `drawConnections` normally arranges slots, but Vue-mode `drawNode` clears
 * `_widgetSlotsDirty`, so that pass is skipped after switching to legacy mode.
 * Vue DOM measurements also differ slightly from legacy slot positions.
 *
 * Delete when `getSlotPosition` is consistent across both renderers.
 */
export function arrangeForLegacyRender(graph: LGraph): void {
  const rootGraphId = graph.rootGraph.id
  graph._nodes.sort(
    (a, b) =>
      (layoutStore.getNodeLayout(rootGraphId, a.id)?.zIndex ?? 0) -
      (layoutStore.getNodeLayout(rootGraphId, b.id)?.zIndex ?? 0)
  )

  for (const node of graph._nodes) {
    if (node.flags.collapsed) continue
    try {
      node.arrange()
    } catch (error) {
      logger.warn('Skipping node that could not be arranged:', node.id, error)
    }
  }
}
