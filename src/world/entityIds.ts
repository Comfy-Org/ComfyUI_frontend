// TODO: Drop disable once NodeId becomes a branded EntityId owned by src/world/.
// eslint-disable-next-line import-x/no-restricted-paths
import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
// TODO: Drop disable once UUID moves to src/utils/ (no litegraph coupling).
// eslint-disable-next-line import-x/no-restricted-paths
import type { UUID } from '@/lib/litegraph/src/utils/uuid'

import type { Brand } from './brand'

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
