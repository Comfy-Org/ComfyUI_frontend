import type { UUID } from '@/utils/uuid'

import type { Brand } from './brand'

export type NodeId = number | string

export type WidgetEntityId = Brand<string, 'WidgetEntityId'>

const SEPARATOR = ':'

export function widgetEntityId(
  graphId: UUID,
  nodeId: NodeId,
  name: string
): WidgetEntityId {
  return `${graphId}${SEPARATOR}${nodeId}${SEPARATOR}${name}` as WidgetEntityId
}

export function parseWidgetEntityId(id: WidgetEntityId): {
  graphId: UUID
  nodeId: NodeId
  name: string
} {
  const firstColon = id.indexOf(SEPARATOR)
  const secondColon = id.indexOf(SEPARATOR, firstColon + 1)
  return {
    graphId: id.slice(0, firstColon),
    nodeId: id.slice(firstColon + 1, secondColon),
    name: id.slice(secondColon + 1)
  }
}

export function isWidgetEntityId(value: unknown): value is WidgetEntityId {
  if (typeof value !== 'string') return false
  const firstColon = value.indexOf(SEPARATOR)
  if (firstColon <= 0) return false
  const secondColon = value.indexOf(SEPARATOR, firstColon + 1)
  return secondColon > firstColon + 1
}
