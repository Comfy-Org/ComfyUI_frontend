import type { LGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

import type { WidgetEntityId } from './entityIds'

/**
 * Resolve a widget by its canonical {@link WidgetEntityId} within a root graph.
 *
 * Returns the host node and widget the entity id describes. For promoted
 * widgets the host is the SubgraphNode and the widget is its `PromotedWidgetView`;
 * for plain widgets the host is the owning node and the widget is its own
 * `IBaseWidget` instance.
 *
 * Identity comparison is purely structural — `widget.entityId === entityId` —
 * so producers and consumers can never disagree about which widget an id refers
 * to.
 */
export function findWidgetByEntityId(
  rootGraph: LGraph,
  entityId: WidgetEntityId
): [LGraphNode, IBaseWidget] | undefined {
  for (const node of rootGraph.nodes) {
    const widget = node.widgets?.find((w) => w.entityId === entityId)
    if (widget) return [node, widget]
  }
  return undefined
}
