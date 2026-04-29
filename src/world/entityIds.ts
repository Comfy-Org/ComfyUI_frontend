/**
 * Entity IDs are deterministic, content-addressed, string-prefixed values
 * — not opaque numerics (cf. bitECS, koota, miniplex).
 *
 * Identity is keyed by `rootGraph.id`, so an entity viewed at different
 * subgraph depths shares state. Migrating to numeric IDs would break
 * cross-subgraph value sharing. See ADR 0008 and `widgetValueStore.ts`.
 *
 * The `graph*Prefix` and `*EntityId` helpers below are the sole owners of
 * the on-the-wire format. Never hand-construct or parse these strings.
 */
import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'

import type { Brand } from './brand'

type GraphId = Brand<UUID, 'GraphId'>

export function asGraphId(id: UUID): GraphId {
  return id as GraphId
}

export type NodeEntityId = Brand<string, 'NodeEntityId'>

export function graphNodePrefix(graphId: GraphId): string {
  return `node:${graphId}:`
}

export function nodeEntityId(graphId: GraphId, nodeId: NodeId): NodeEntityId {
  return `${graphNodePrefix(graphId)}${nodeId}` as NodeEntityId
}

export type WidgetEntityId = Brand<string, 'WidgetEntityId'>

export function graphWidgetPrefix(graphId: GraphId): string {
  return `widget:${graphId}:`
}

export function widgetEntityId(
  graphId: GraphId,
  nodeId: NodeId,
  name: string
): WidgetEntityId {
  return `${graphWidgetPrefix(graphId)}${nodeId}:${name}` as WidgetEntityId
}

export type EntityId = NodeEntityId | WidgetEntityId
