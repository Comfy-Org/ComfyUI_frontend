import type { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { widgetId } from '@/types/widgetId'
import {
  getNodeByLocatorId,
  locatorIdFromState
} from '@/utils/graphTraversalUtil'
import { mapLiveWidgetsById } from '@/utils/litegraphUtil'

import type { SemanticWidgetEffectPort } from './graphMutations'

export interface LiveWidgetEffectDeps {
  /** The live root graph, or null when no workflow is open. */
  getGraph(): LGraph | null
  /** The canvas showing that graph; passed to `callback` like the Vue path. */
  getCanvas(): LGraphCanvas | undefined
}

/**
 * Runs the effects a human edit runs (`createWidgetUpdateHandler` in the Vue
 * renderer) for a widget value the follower just committed. Resolution
 * happens per call, so an entry whose node or widget an earlier callback
 * removed is a no-op, and a node the batch replaced (its live object still
 * in the graph until `reconcileLiveGraph`) never receives its successor's
 * value.
 */
export function createLiveWidgetEffectPort(
  deps: LiveWidgetEffectDeps
): SemanticWidgetEffectPort {
  return {
    valueApplied(scope, nodeId, name, value, previous) {
      const rootGraph = deps.getGraph()?.rootGraph
      if (!rootGraph || rootGraph.id !== scope.rootGraphId) return
      const locatorId = locatorIdFromState(
        { id: nodeId, graphId: scope.owningGraphId },
        rootGraph.id
      )
      const node = locatorId ? getNodeByLocatorId(rootGraph, locatorId) : null
      if (!node || !useNodeDataStore().ownsNode(scope, node._state)) return
      const widget = mapLiveWidgetsById(node).get(
        widgetId(scope.rootGraphId, nodeId, name)
      )
      if (!widget) return
      widget.value = value
      widget.callback?.(value, deps.getCanvas(), node)
      node.onWidgetChanged?.(name, value, previous, widget)
      node.widgets?.forEach((w) => w.triggerDraw?.())
    }
  }
}
