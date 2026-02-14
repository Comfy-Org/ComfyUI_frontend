import { promoteRecommendedWidgets } from '@/core/graph/subgraph/proxyWidgetUtils'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'

export function registerProxyWidgets(canvas: LGraphCanvas) {
  canvas.canvas.addEventListener<'subgraph-converted'>(
    'subgraph-converted',
    (e) => promoteRecommendedWidgets(e.detail.subgraphNode)
  )
}
