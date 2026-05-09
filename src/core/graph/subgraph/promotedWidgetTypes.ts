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
}

/**
 * Legacy proxyWidget tuple shape carried through migration. The optional
 * `disambiguatingSourceNodeId` is read from legacy `properties.proxyWidgets`
 * payloads only — canonical runtime state never sets it. See ADR 0009.
 */
export interface LegacyProxyEntrySource extends PromotedWidgetSource {
  disambiguatingSourceNodeId?: string
}

export interface PromotedWidgetView extends IBaseWidget {
  readonly node: SubgraphNode
  /**
   * Identity of the immediate interior child whose widget (or input slot, for
   * nested SubgraphNode children) this view exposes. Per ADR 0009 each
   * SubgraphNode is opaque: the parent's promoted view references the
   * immediate child only and does not flatten to deeper origins.
   */
  readonly sourceNodeId: string
  readonly sourceWidgetName: string
}

export function isPromotedWidgetView(
  widget: IBaseWidget
): widget is PromotedWidgetView {
  return 'sourceNodeId' in widget && 'sourceWidgetName' in widget
}
