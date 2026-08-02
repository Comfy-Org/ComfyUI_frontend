import log from 'loglevel'

import type { LGraph } from '@/lib/litegraph/src/litegraph'

const logger = log.getLogger('arrangeForLegacyRender')

/**
 * Computes slot positions for every node so the legacy canvas has them before
 * it draws.
 *
 * `drawConnections` has its own arrange pass, but it is gated on
 * `_widgetSlotsDirty`, which Vue-mode `drawNode` clears every frame — so that
 * gate never fires after a mode switch. Meanwhile Vue-mode `_measureSlots`
 * derived widget-input positions from DOM slot layouts, which sit a couple of
 * pixels off the values the legacy canvas computes.
 *
 * Delete this once `getSlotPosition` returns the same numbers in both modes.
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
