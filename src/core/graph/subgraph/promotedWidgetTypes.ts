import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { WidgetId } from '@/world/entityIds'

export interface ResolvedPromotedWidget {
  node: LGraphNode
  widget: IBaseWidget
}

export interface PromotedWidgetSource {
  sourceNodeId: string
  sourceWidgetName: string
}

export interface PromotedWidgetView extends IBaseWidget {
  readonly node: SubgraphNode
  readonly widgetId: WidgetId
  readonly sourceNodeId: string
  readonly sourceWidgetName: string

  hydrateHostValue(value: IBaseWidget['value']): void

  ensureHostWidgetState(): void
}

export function isPromotedWidgetView(
  widget: IBaseWidget
): widget is PromotedWidgetView {
  return 'sourceNodeId' in widget && 'sourceWidgetName' in widget
}
