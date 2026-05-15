import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { WidgetState } from '@/stores/widgetValueStore'

import { parseWidgetEntityId } from './entityIds'
import type { WidgetEntityId } from './entityIds'

/**
 * Single read/write surface for widget values keyed by {@link WidgetEntityId}.
 *
 * Producers (Vue mapper, runtime callbacks, migration) and consumers (sidebar,
 * click handlers, serialization) call these helpers instead of composing
 * `(graphId, nodeId, widgetName)` tuples themselves. A `WidgetEntityId`
 * collision becomes a TypeScript error, not a silent value mix-up.
 *
 * Internally delegates to {@link useWidgetValueStore}; replacing the storage
 * implementation (e.g. with the ECS world from PR #11706) does not require any
 * call-site changes.
 */

/**
 * Look up the full {@link WidgetState} for a widget by entity id, or
 * `undefined` if not yet registered.
 */
export function getWidgetState(
  entityId: WidgetEntityId
): WidgetState | undefined {
  const { graphId, nodeId, name } = parseWidgetEntityId(entityId)
  return useWidgetValueStore().getWidget(graphId, nodeId, name)
}

/**
 * Read the current value of a widget by entity id, or `undefined` if not yet
 * registered.
 */
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

/**
 * Initial-state shape for {@link ensureWidgetState}: the per-widget metadata
 * not encoded in the {@link WidgetEntityId}.
 */
type WidgetStateInit = Omit<WidgetState, 'nodeId' | 'name'>

/**
 * Register a widget by entity id if not already registered, returning the
 * (existing or newly-registered) {@link WidgetState}. Idempotent.
 */
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
