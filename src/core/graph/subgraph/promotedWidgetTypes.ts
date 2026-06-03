import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

export interface ResolvedPromotedWidget {
  node: LGraphNode
  widget: IBaseWidget
}

export interface PromotedWidgetSource {
  sourceNodeId: string
  sourceWidgetName: string
}

/**
 * A widget that carries the identity of the interior source it was promoted
 * from. Promoted host widgets are store-backed and addressed by widgetId; this
 * source identity drives promote/demote and linked-promotion checks.
 */
export type PromotedWidget = IBaseWidget & PromotedWidgetSource

export function isPromotedWidget(
  widget: IBaseWidget
): widget is PromotedWidget {
  return 'sourceNodeId' in widget && 'sourceWidgetName' in widget
}
