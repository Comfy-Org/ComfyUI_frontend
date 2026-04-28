/**
 * Entity IDs are deterministic, content-addressed, and string-prefix
 * encoded — NOT opaque numeric IDs (cf. bitECS, koota, miniplex).
 *
 * `widgetEntityId(rootGraphId, nodeId, name)` is load-bearing:
 * consumers consistently pass `rootGraph.id` so widgets viewed at
 * different subgraph depths share identity. Migrating to numeric IDs
 * would break cross-subgraph value sharing. See ADR 0008 and
 * widgetValueStore for the canonical keying contract.
 */
import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'

import type { Brand } from './brand'

type GraphId = Brand<UUID, 'GraphId'>
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
