import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

export interface ResolvedPromotedWidget {
  node: LGraphNode
  widget: IBaseWidget
}

export interface PromotedWidgetSource {
  sourceNodeId: string
  sourceWidgetName: string
  disambiguatingSourceNodeId?: string
}

export interface PromotedWidgetView extends IBaseWidget {
  readonly node: SubgraphNode
  readonly sourceNodeId: string
  readonly sourceWidgetName: string
  /**
   * The original leaf-level source node ID, used to distinguish promoted
   * widgets with the same name on the same intermediate node. Unlike
   * `sourceNodeId` (the direct interior node), this traces to the deepest
   * origin.
   */
  readonly disambiguatingSourceNodeId?: string
}

export function isPromotedWidgetView(
  widget: IBaseWidget
): widget is PromotedWidgetView {
  return 'sourceNodeId' in widget && 'sourceWidgetName' in widget
}
