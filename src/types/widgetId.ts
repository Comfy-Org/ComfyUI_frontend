type NodeId = number | string
type UUID = string

export type WidgetId = string & { readonly __brand: 'WidgetId' }

const SEPARATOR = ':'

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
  const firstColon = id.indexOf(SEPARATOR)
  const secondColon = id.indexOf(SEPARATOR, firstColon + 1)
  const nodeId = id.slice(firstColon + 1, secondColon)
  const name = id.slice(secondColon + 1)
  return {
    graphId: id.slice(0, firstColon),
    nodeId: decodeWidgetIdSegment(nodeId),
    name: decodeWidgetIdSegment(name)
  }
}

export function isWidgetId(value: unknown): value is WidgetId {
  if (typeof value !== 'string') return false
  const firstColon = value.indexOf(SEPARATOR)
  if (firstColon <= 0) return false
  const secondColon = value.indexOf(SEPARATOR, firstColon + 1)
  return secondColon > firstColon + 1
}
