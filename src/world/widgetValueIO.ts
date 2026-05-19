import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { WidgetState } from '@/stores/widgetValueStore'

import { parseWidgetEntityId } from './entityIds'
import type { WidgetEntityId } from './entityIds'

// Single read/write surface for widget values keyed by WidgetEntityId, so a key
// collision is a TypeScript error rather than a silent value mix-up. Delegates
// to useWidgetValueStore so storage can be swapped (e.g. ECS world, PR #11706)
// without call-site changes.

/** Look up the full {@link WidgetState} for a widget by entity id. */
export function getWidgetState(
  entityId: WidgetEntityId
): WidgetState | undefined {
  const { graphId, nodeId, name } = parseWidgetEntityId(entityId)
  return useWidgetValueStore().getWidget(graphId, nodeId, name)
}

/** Read the current value of a widget by entity id. */
export function readWidgetValue(
  entityId: WidgetEntityId
): WidgetState['value'] | undefined {
  return getWidgetState(entityId)?.value
}

/**
 * Write a new value to a widget by entity id. Returns `true` if the widget
 * was registered and updated, `false` if no such state exists.
 *
 * Does not register the widget — call {@link ensureWidgetState} first if the
 * widget may not yet exist.
 */
export function writeWidgetValue(
  entityId: WidgetEntityId,
  value: WidgetState['value']
): boolean {
  const { graphId, nodeId, name } = parseWidgetEntityId(entityId)
  return useWidgetValueStore().setValue(graphId, nodeId, name, value)
}

type WidgetStateInit = Omit<WidgetState, 'nodeId' | 'name'>

/** Idempotently register a widget by entity id, returning its {@link WidgetState}. */
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
