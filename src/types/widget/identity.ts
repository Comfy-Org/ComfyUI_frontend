/**
 * Widget identity types — the smallest shell in the matryoshka.
 *
 * @module widget/identity
 */

import type { NodeId, WidgetId } from './primitives'
import { widgetId } from './primitives'

export interface WidgetIdentity {
  readonly nodeId: NodeId
  readonly name: string
}

export function getWidgetId(widget: WidgetIdentity): WidgetId {
  return widgetId(widget.nodeId, widget.name)
}
