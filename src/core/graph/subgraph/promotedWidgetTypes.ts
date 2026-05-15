import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { WidgetEntityId } from '@/world/entityIds'

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
  /**
   * Canonical host-scoped identity per ADR 0009: `(host node, subgraph input
   * name)`. Always defined for promoted widgets — they are owned by their
   * host and the host is by construction bound to a graph.
   */
  readonly entityId: WidgetEntityId
  /**
   * Identity of the immediate interior child whose widget (or input slot, for
   * nested SubgraphNode children) this view exposes. Per ADR 0009 each
   * SubgraphNode is opaque: the parent's promoted view references the
   * immediate child only and does not flatten to deeper origins.
   */
  readonly sourceNodeId: string
  readonly sourceWidgetName: string

  /**
   * Per-instance value hydration that writes only to host widget state, never
   * cascading into the shared interior widget. Used during configure/clone.
   */
  hydrateHostValue(value: IBaseWidget['value']): void

  /**
   * Ensure a host-scoped widget store entry exists, seeded with the current
   * effective value. Idempotent; safe to call before each Vue render.
   */
  ensureHostWidgetState(): void
}

export function isPromotedWidgetView(
  widget: IBaseWidget
): widget is PromotedWidgetView {
  return 'sourceNodeId' in widget && 'sourceWidgetName' in widget
}
