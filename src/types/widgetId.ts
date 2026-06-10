import { asNodeId } from '@/lib/litegraph/src/utils/nodeId'
import type { NodeId } from '@/lib/litegraph/src/utils/nodeId'

type UUID = string

export type WidgetId = string & { readonly __brand: 'WidgetId' }

const SEPARATOR = ':'
const WIDGET_ID_PATTERN = /^(?<graphId>[^:]+):(?<nodeId>[^:]+):(?<name>[^:]+)$/u

export function widgetId(
  graphId: UUID,
  nodeId: NodeId,
  name: string
): WidgetId {
  return [
    graphId,
    encodeURIComponent(String(nodeId)),
    encodeURIComponent(name)
  ].join(SEPARATOR) as WidgetId
}

function decodeWidgetIdSegment(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch (error) {
    if (error instanceof URIError) return segment
    throw error
  }
}

export function parseWidgetId(id: WidgetId): {
  graphId: UUID
  nodeId: NodeId
  name: string
} {
  const groups = WIDGET_ID_PATTERN.exec(id)?.groups
  if (!groups) throw new Error('Invalid widget id')

  return {
    graphId: groups.graphId,
    nodeId: asNodeId(decodeWidgetIdSegment(groups.nodeId)),
    name: decodeWidgetIdSegment(groups.name)
  }
}

export function isWidgetId(value: unknown): value is WidgetId {
  if (typeof value !== 'string') return false
  return WIDGET_ID_PATTERN.test(value)
}

/** Normalises a raw persisted value into a {@link WidgetId}. */
export function asWidgetId(value: string | number): WidgetId {
  return String(value) as WidgetId
}
