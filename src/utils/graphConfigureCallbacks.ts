import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { triggerCallbackOnAllNodes } from '@/utils/graphTraversalUtil'

/** Fires `onGraphConfigured` before and `onAfterGraphConfigured` after every configure of `graph`. */
export function installGraphConfigureCallbacks(graph: LGraph): void {
  const { onConfigure } = graph
  graph.onConfigure = function (...args) {
    triggerCallbackOnAllNodes(this, 'onGraphConfigured')
    const result = onConfigure?.apply(this, args)
    triggerCallbackOnAllNodes(this, 'onAfterGraphConfigured')
    return result
  }
}
