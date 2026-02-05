/**
 * Primitive types for widget identification.
 *
 * @module widget/primitives
 */

export type NodeId = number

export type WidgetId = `${NodeId}:${string}`

export function widgetId(nodeId: NodeId, name: string): WidgetId {
  return `${nodeId}:${name}`
}
