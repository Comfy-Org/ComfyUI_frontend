import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'

import type { Brand } from './brand'

/**
 * Globally unique identity for a single widget on a single node, scoped to a
 * single root graph. The same conceptual widget viewed at different subgraph
 * depths shares the same `WidgetEntityId` because identity is keyed by the
 * root graph, not by the subgraph instance path. This matches the existing
 * `widgetValueStore` graph-scoping convention.
 *
 * Format: `${graphId}:${nodeId}:${name}`. The graph id is a UUID (no colons),
 * so the first two colons unambiguously separate the three components.
 *
 * Constructed only via {@link widgetEntityId}; cannot be silently impersonated
 * by an arbitrary string.
 */
export type WidgetEntityId = Brand<string, 'WidgetEntityId'>

const SEPARATOR = ':'

/**
 * Build a {@link WidgetEntityId} from its components.
 */
export function widgetEntityId(
  graphId: UUID,
  nodeId: NodeId,
  name: string
): WidgetEntityId {
  return `${graphId}${SEPARATOR}${nodeId}${SEPARATOR}${name}` as WidgetEntityId
}

/**
 * Parse a {@link WidgetEntityId} back into its components.
 *
 * Splits on the first two colons; the trailing segment is returned verbatim
 * so widget names containing colons round-trip safely.
 */
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

/**
 * Type guard for {@link WidgetEntityId}. Verifies the string has at least two
 * colons; does not validate the graph-id portion as a real UUID because callers
 * may use synthetic graph ids in tests.
 */
export function isWidgetEntityId(value: unknown): value is WidgetEntityId {
  if (typeof value !== 'string') return false
  const firstColon = value.indexOf(SEPARATOR)
  if (firstColon <= 0) return false
  const secondColon = value.indexOf(SEPARATOR, firstColon + 1)
  return secondColon > firstColon + 1
}
