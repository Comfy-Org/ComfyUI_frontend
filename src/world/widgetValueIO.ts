import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { WidgetState } from '@/stores/widgetValueStore'
import { parseWidgetEntityId } from '@/world/entityIds'
import type { WidgetEntityId } from '@/world/entityIds'

export function getWidgetState(
  entityId: WidgetEntityId
): WidgetState | undefined {
  const { graphId, nodeId, name } = parseWidgetEntityId(entityId)
  return useWidgetValueStore()._lookupWidgetState(graphId, nodeId, name)
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

export function ensureWidgetState(
  entityId: WidgetEntityId,
  init: WidgetState
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
