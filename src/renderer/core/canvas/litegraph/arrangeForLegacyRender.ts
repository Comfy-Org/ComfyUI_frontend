import log from 'loglevel'

import type { LGraph } from '@/lib/litegraph/src/litegraph'

const logger = log.getLogger('arrangeForLegacyRender')

/**
 * Computes slot positions for every node so the legacy canvas has them before
 * it draws.
 *
 * `drawConnections` can run before `drawNode` on the foreground canvas, so
 * without this the first frame after leaving Vue nodes draws links against
 * slot positions that were never arranged.
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
