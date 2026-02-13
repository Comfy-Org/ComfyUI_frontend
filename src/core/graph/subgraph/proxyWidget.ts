import { promoteRecommendedWidgets } from '@/core/graph/subgraph/proxyWidgetUtils'
import { parseProxyWidgets } from '@/core/schemas/proxyWidget'
import type {
  LGraph,
  LGraphCanvas,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets.ts'
import { disconnectedWidget } from '@/lib/litegraph/src/widgets/DisconnectedWidget'

type Overlay = Partial<IBaseWidget> & {
  graph: LGraph
  nodeId: string
  widgetName: string
  isProxyWidget: boolean
  node?: LGraphNode
}

type ProxyWidget = IBaseWidget & { _overlay: Overlay }
export function isProxyWidget(w: IBaseWidget): w is ProxyWidget {
  return (w as { _overlay?: Overlay })?._overlay?.isProxyWidget ?? false
}
export function isDisconnectedWidget(w: ProxyWidget) {
  return w instanceof disconnectedWidget.constructor
}

export function registerProxyWidgets(canvas: LGraphCanvas) {
  canvas.canvas.addEventListener<'subgraph-opened'>('subgraph-opened', (e) => {
    const { subgraph, fromNode } = e.detail
    const proxyWidgets = parseProxyWidgets(fromNode.properties.proxyWidgets)
    for (const node of subgraph.nodes) {
      for (const widget of node.widgets ?? []) {
        widget.promoted = proxyWidgets.some(
          ([n, w]) => node.id == n && widget.name == w
        )
      }
    }
  })
  canvas.canvas.addEventListener<'subgraph-converted'>(
    'subgraph-converted',
    (e) => promoteRecommendedWidgets(e.detail.subgraphNode)
  )
}
