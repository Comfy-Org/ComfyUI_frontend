import { promoteRecommendedWidgets } from '@/core/graph/subgraph/proxyWidgetUtils'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { usePromotionStore } from '@/stores/promotionStore'

export function registerProxyWidgets(canvas: LGraphCanvas) {
  canvas.canvas.addEventListener<'subgraph-opened'>('subgraph-opened', (e) => {
    const { subgraph, fromNode } = e.detail
    const store = usePromotionStore()
    for (const node of subgraph.nodes) {
      for (const widget of node.widgets ?? []) {
        widget.promoted = store.isPromoted(
          fromNode.id,
          String(node.id),
          widget.name
        )
      }
    }
  })
  canvas.canvas.addEventListener<'subgraph-converted'>(
    'subgraph-converted',
    (e) => promoteRecommendedWidgets(e.detail.subgraphNode)
  )
}
