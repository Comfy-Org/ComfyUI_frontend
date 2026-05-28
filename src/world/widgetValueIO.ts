import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { WidgetState } from '@/stores/widgetValueStore'
import type { UUID } from '@/utils/uuid'
import { deriveWidgetEntityId, parseWidgetEntityId } from '@/world/entityIds'
import type { NodeId, WidgetEntityId } from '@/world/entityIds'

export function getWidgetState(
  entityId: WidgetEntityId
): WidgetState | undefined {
  const { graphId, nodeId, name } = parseWidgetEntityId(entityId)
  return useWidgetValueStore()._lookupWidgetState(graphId, nodeId, name)
}

/**
 * Lookup helper for callers that hold a raw `(graphId, nodeId, name)` triple
 * rather than a widget instance with a derived `entityId`. Returns
 * `undefined` when any input would produce a non-derivable entity id.
 *
 * Prefer `getWidgetState(widget.entityId)` when a widget object is in scope;
 * the branded `WidgetEntityId` prevents producer/consumer drift that loose
 * triples allow.
 */
export function getWidgetStateByTriple(
  graphId: UUID | undefined,
  nodeId: NodeId | undefined,
  name: string
): WidgetState | undefined {
  const entityId = deriveWidgetEntityId(graphId, nodeId, name)
  return entityId === undefined ? undefined : getWidgetState(entityId)
}

export function readWidgetValue(
  entityId: WidgetEntityId
): WidgetState['value'] | undefined {
  return getWidgetState(entityId)?.value
}

export function writeWidgetValue(
  entityId: WidgetEntityId,
  value: WidgetState['value']
): boolean {
  const { graphId, nodeId, name } = parseWidgetEntityId(entityId)
  return useWidgetValueStore().setValue(graphId, nodeId, name, value)
}

type WidgetStateInit = Omit<WidgetState, 'nodeId' | 'name'>

export function ensureWidgetState(
  entityId: WidgetEntityId,
  init: WidgetStateInit
): WidgetState {
  const existing = getWidgetState(entityId)
  if (existing) return existing
  const { graphId, nodeId, name } = parseWidgetEntityId(entityId)
  return useWidgetValueStore().registerWidget(graphId, {
    ...init,
    nodeId,
    name
  })
}
