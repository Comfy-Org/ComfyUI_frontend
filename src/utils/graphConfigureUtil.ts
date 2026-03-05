import type { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { flushScheduledSlotLayoutSync } from '@/renderer/extensions/vueNodes/composables/useSlotElementTracking'
import { triggerCallbackOnAllNodes } from '@/utils/graphTraversalUtil'
import { fixLinkInputSlots } from '@/utils/litegraphUtil'

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
      fixLinkInputSlots(this)

      triggerCallbackOnAllNodes(this, 'onGraphConfigured')

      return onConfigure?.apply(this, args)
    } finally {
      triggerCallbackOnAllNodes(this, 'onAfterGraphConfigured')

      if (LiteGraph.vueNodesMode) {
        flushScheduledSlotLayoutSync()
        getCanvas()?.setDirty(true, true)
      }
    }
  }
}
