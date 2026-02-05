/**
 * Primitive types for widget identification.
 *
 * @module widget/primitives
 */

import type { NodeId as LiteGraphNodeId } from '@/lib/litegraph/src/LGraphNode'

/**
 * NodeId matches LiteGraph's type for compatibility with the graph system.
 */
export type NodeId = LiteGraphNodeId

export type WidgetId = `${NodeId}:${string}`

export function widgetId(nodeId: NodeId, name: string): WidgetId {
  return `${nodeId}:${name}` as WidgetId
}
