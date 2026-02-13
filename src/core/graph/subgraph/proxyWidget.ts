import { promoteRecommendedWidgets } from '@/core/graph/subgraph/proxyWidgetUtils'
import type { PromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetView'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'

export function registerProxyWidgets(canvas: LGraphCanvas) {
  canvas.canvas.addEventListener<'subgraph-opened'>('subgraph-opened', (e) => {
    const { subgraph, fromNode } = e.detail
    // TODO: Derive `promoted` reactively via a Pinia store instead of
    // imperatively setting it on subgraph open.
    const promotedEntries = new Set(
      fromNode.widgets
        .filter((w): w is PromotedWidgetView => 'sourceNodeId' in w)
        .map((w) => `${w.sourceNodeId}:${w.sourceWidgetName}`)
    )
    for (const node of subgraph.nodes) {
      for (const widget of node.widgets ?? []) {
        widget.promoted = promotedEntries.has(`${node.id}:${widget.name}`)
      }
    }
  })
  canvas.canvas.addEventListener<'subgraph-converted'>(
    'subgraph-converted',
    (e) => promoteRecommendedWidgets(e.detail.subgraphNode)
  )
}
