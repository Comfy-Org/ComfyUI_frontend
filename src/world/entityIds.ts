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
import type { UUID } from '@/utils/uuid'

import type { Brand } from './brand'

export type NodeId = number | string

type GraphId = Brand<UUID, 'GraphId'>

export function asGraphId(id: UUID): GraphId {
  return id as GraphId
}

export type NodeEntityId = Brand<string, 'NodeEntityId'>

function graphNodePrefix(graphId: GraphId): string {
  return `node:${graphId}:`
}

export function nodeEntityId(graphId: GraphId, nodeId: NodeId): NodeEntityId {
  return `${graphNodePrefix(graphId)}${nodeId}` as NodeEntityId
}

export type WidgetEntityId = Brand<string, 'WidgetEntityId'>

function graphWidgetPrefix(graphId: GraphId): string {
  return `widget:${graphId}:`
}

export function widgetEntityId(
  graphId: UUID | GraphId,
  nodeId: NodeId,
  name: string
): WidgetEntityId {
  return `${graphWidgetPrefix(graphId as GraphId)}${nodeId}:${name}` as WidgetEntityId
}

/**
 * Guarded factory for `WidgetEntityId`. Returns `undefined` when any input
 * required to construct the id is missing — graphless widgets, unbound
 * node ids (`-1`), or unknown node ids cannot have a valid entity id.
 *
 * Use this from call sites that hold raw widget identity (graphId, nodeId,
 * name); use the `widget.entityId` getter directly when you already have a
 * `BaseWidget` instance.
 */
export function deriveWidgetEntityId(
  graphId: UUID | GraphId | undefined,
  nodeId: NodeId | undefined,
  name: string
): WidgetEntityId | undefined {
  if (!graphId || nodeId === undefined || nodeId === -1) return undefined
  return widgetEntityId(graphId, nodeId, name)
}

/**
 * Parse a `WidgetEntityId` into its constituent parts.
 *
 * On-the-wire format: `widget:${graphId}:${nodeId}:${name}`. The regex
 * captures the first two colon-delimited segments as graphId and nodeId,
 * then takes the rest as the widget name — so widget names may contain
 * colons (e.g. `images.image:0`). NodeId values containing colons split
 * at the first colon; production NodeIds are scalar-shaped, so this is a
 * documented edge case rather than a defect. Throws on malformed input
 * so upstream cast bugs surface at the parse site.
 */
const WIDGET_ID_RE = /^widget:([^:]+):([^:]+):(.*)$/

export function parseWidgetEntityId(id: WidgetEntityId): {
  graphId: GraphId
  nodeId: NodeId
  name: string
} {
  const match = WIDGET_ID_RE.exec(id)
  if (!match) {
    throw new Error(`Malformed WidgetEntityId: ${id}`)
  }
  const [, graphId, nodeId, name] = match
  return {
    graphId: graphId as GraphId,
    nodeId: nodeId as NodeId,
    name
  }
}

export function isWidgetEntityId(value: unknown): value is WidgetEntityId {
  return typeof value === 'string' && WIDGET_ID_RE.test(value)
}

export function isNodeIdForGraph(graphId: GraphId, id: NodeEntityId): boolean {
  return id.startsWith(graphNodePrefix(graphId))
}

export function isWidgetIdForGraph(
  graphId: GraphId,
  id: WidgetEntityId
): boolean {
  return id.startsWith(graphWidgetPrefix(graphId))
}
