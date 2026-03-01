import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

export type ResolvedPromotedWidget = {
  node: LGraphNode
  widget: IBaseWidget
}

export interface PromotedWidgetView extends IBaseWidget {
  readonly node: SubgraphNode
  readonly sourceNodeId: string
  readonly sourceWidgetName: string
}

export function isPromotedWidgetView(
  widget: IBaseWidget
): widget is PromotedWidgetView {
  return 'sourceNodeId' in widget && 'sourceWidgetName' in widget
}
