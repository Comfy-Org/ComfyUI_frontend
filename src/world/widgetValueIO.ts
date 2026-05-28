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
 * Transitional bridge — DO NOT use from new code.
 *
 * This function exists only so the existing `(graphId, nodeId, name)`-keyed
 * call sites can migrate to the world-backed lookup incrementally. Every
 * new consumer must take a `WidgetEntityId` instead and call
 * `getWidgetState(widget.entityId)` directly; the branded entity id is the
 * canonical key (see ADR 0008 §3.3 and the entity-id contract in
 * `src/world/entityIds.ts`).
 *
 * Removal plan: refactor the remaining triple-form callers
 * (`src/renderer/glsl/*`, `src/renderer/extensions/vueNodes/**`,
 * `src/extensions/core/uploadAudio.ts`) to plumb the `WidgetEntityId`
 * through their call chain, then delete this function. Until then, treat
 * every new reference as a regression — extend the upstream API so the
 * caller can hold the entity id instead.
 *
 * Returns `undefined` when any input would produce a non-derivable entity
 * id (missing graph, unbound node id `-1`, etc.).
 *
 * @deprecated Use `getWidgetState(widget.entityId)`. Pending removal once
 * the listed call sites migrate.
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
