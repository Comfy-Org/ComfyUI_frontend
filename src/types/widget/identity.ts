/**
 * Widget identity types — the smallest shell in the matryoshka.
 *
 * @module widget/identity
 */

import type { NodeId, WidgetId } from './primitives'
import { widgetId } from './primitives'

/**
 * Immutable widget identity for public APIs and type safety.
 */
export interface WidgetIdentity {
  readonly nodeId: NodeId
  readonly name: string
}

/**
 * Mutable widget identity for internal state management.
 * Used by stores that need to update identity after construction.
 */
export interface MutableWidgetIdentity {
  nodeId: NodeId
  name: string
}

export function getWidgetId(widget: WidgetIdentity): WidgetId {
  return widgetId(widget.nodeId, widget.name)
}
