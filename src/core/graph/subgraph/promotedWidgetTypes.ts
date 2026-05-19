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
  /** Host-scoped identity `(host node, subgraph input name)` per ADR 0009. */
  readonly entityId: WidgetEntityId
  /** Immediate interior child id; per ADR 0009 SubgraphNode is opaque so this never flattens past the immediate child. */
  readonly sourceNodeId: string
  readonly sourceWidgetName: string

  /**
   * Per-instance value hydration that writes only to host widget state, never
   * cascading into the shared interior widget. Used during configure/clone.
   */
  hydrateHostValue(value: IBaseWidget['value']): void

  /** Idempotently ensures a host-scoped widget store entry seeded with the current effective value; safe to call per render. */
  ensureHostWidgetState(): void
}

export function isPromotedWidgetView(
  widget: IBaseWidget
): widget is PromotedWidgetView {
  return 'sourceNodeId' in widget && 'sourceWidgetName' in widget
}
