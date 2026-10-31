import { promotedInputSource } from '@/core/graph/subgraph/promotedInputWidget'
import { resolveConcretePromotedWidget } from '@comfyorg/litegraph/subgraph/promotion/resolveConcretePromotedWidget'
import type { LGraph } from '@comfyorg/litegraph/litegraph'
import { useWidgetValueStore } from '@comfyorg/graph-state/widgetValueStore'
import { forEachNode } from '@comfyorg/litegraph/utils/graphTraversalUtil'

/** Copies each promoted combo source's current options onto its subgraph host. */
export function syncPromotedComboHostOptions(rootGraph: LGraph): void {
  const widgetValueStore = useWidgetValueStore()
  forEachNode(rootGraph, (node) => {
    if (!node.isSubgraphNode()) return
    for (const input of node.inputs) {
      if (!input.widgetId) continue

      const source = promotedInputSource(node, input)
      if (!source) continue

      const resolution = resolveConcretePromotedWidget(
        node,
        source.nodeId,
        source.widgetName
      )
      if (resolution.status !== 'resolved') continue

      const sourceWidget = resolution.resolved.widget
      if (sourceWidget.type !== 'combo') continue

      const state = widgetValueStore.getWidget(input.widgetId)
      if (!state) continue

      state.options = { ...sourceWidget.options }
    }
  })
}
