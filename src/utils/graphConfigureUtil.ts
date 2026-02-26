import type { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { flushScheduledSlotLayoutSync } from '@/renderer/extensions/vueNodes/composables/useSlotElementTracking'
import { triggerCallbackOnAllNodes } from '@/utils/graphTraversalUtil'
import {
  fixLinkInputSlots,
  hasLegacyLinkInputSlotMismatch
} from '@/utils/litegraphUtil'

/**
 * Wraps graph.onConfigure to add legacy slot repair,
 * node configure callbacks, and layout sync flushing.
 */
export function addAfterConfigureHandler(
  graph: LGraph,
  getCanvas: () => LGraphCanvas | undefined
) {
  const { onConfigure } = graph
  graph.onConfigure = function (...args) {
    if (LiteGraph.vueNodesMode) {
      layoutStore.setPendingSlotSync(true)
    }

    try {
      if (hasLegacyLinkInputSlotMismatch(this)) fixLinkInputSlots(this)

      triggerCallbackOnAllNodes(this, 'onGraphConfigured')

      const r = onConfigure?.apply(this, args)

      triggerCallbackOnAllNodes(this, 'onAfterGraphConfigured')

      return r
    } finally {
      if (LiteGraph.vueNodesMode) {
        flushScheduledSlotLayoutSync()
        getCanvas()?.setDirty(true, true)
      }
    }
  }
}
