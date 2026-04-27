import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'

import type { Brand } from './brand'

export type GraphId = Brand<UUID, 'GraphId'>
export type NodeEntityId = Brand<string, 'NodeEntityId'>
export type WidgetEntityId = Brand<string, 'WidgetEntityId'>

export type EntityId = NodeEntityId | WidgetEntityId

/**
 * Cast a UUID into a `GraphId`. Pinned at the seam so the rest of the world
 * code does not have to know about UUID-vs-GraphId.
 */
export function asGraphId(id: UUID): GraphId {
  return id as GraphId
}

/**
 * Deterministic widget-entity id derived from `(rootGraphId, nodeId, name)`.
 *
 * Matches the existing `WidgetValueStore` keying contract: nodes viewed at
 * different subgraph depths share the same widget state because consumers
 * pass `rootGraph.id`. See [widgetValueStore.ts](../stores/widgetValueStore.ts).
 */
export function widgetEntityId(
  graphId: GraphId,
  nodeId: NodeId,
  name: string
): WidgetEntityId {
  return `widget:${graphId}:${nodeId}:${name}` as WidgetEntityId
}

/**
 * Deterministic node-entity id derived from `(rootGraphId, nodeId)`.
 */
export function nodeEntityId(graphId: GraphId, nodeId: NodeId): NodeEntityId {
  return `node:${graphId}:${nodeId}` as NodeEntityId
}
