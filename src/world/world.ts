import { reactive } from 'vue'

import type { ComponentKey } from './componentKey'
import type { EntityId } from './entityIds'

/**
 * Storage strategy: AoS (per-entity reactive object reference) backed by
 * `reactive(Map)`. Component values are stored by reference; mutating a
 * value's fields propagates to all readers through Vue's reactive proxy.
 * `setComponent(id, key, ref)` is intentionally identity-preserving.
 *
 * NOT a sparse-set / archetype store. A future SoA migration would break
 * the shared-reactive-identity contract that BaseWidget._state and the
 * widgetValueStore facade rely on; do not refactor without revisiting
 * those consumers. See temp/plans/world-consolidation.md §C.
 */

/**
 * Minimal ECS world surface for slice 1. Exposes plain
 * `getComponent`/`setComponent`/`removeComponent` plumbing only.
 *
 * Deferred (later slices): commands, transactions, undo, scope filtering,
 * iteration helpers beyond `entitiesWith`.
 */
export interface World {
  getComponent<TData, TEntity extends EntityId>(
    id: TEntity,
    key: ComponentKey<TData, TEntity>
  ): TData | undefined
  setComponent<TData, TEntity extends EntityId>(
    id: TEntity,
    key: ComponentKey<TData, TEntity>,
    data: TData
  ): void
  removeComponent<TData, TEntity extends EntityId>(
    id: TEntity,
    key: ComponentKey<TData, TEntity>
  ): void
  entitiesWith<TData, TEntity extends EntityId>(
    key: ComponentKey<TData, TEntity>
  ): TEntity[]
}

export function createWorld(): World {
  const store = new Map<string, Map<EntityId, unknown>>()

  return {
    getComponent<TData, TEntity extends EntityId>(
      id: TEntity,
      key: ComponentKey<TData, TEntity>
    ): TData | undefined {
      const map = store.get(key.name)
      if (!map) return undefined
      return map.get(id) as TData | undefined
    },
    setComponent(id, key, data) {
      let map = store.get(key.name)
      if (!map) {
        map = reactive(new Map<EntityId, unknown>()) as Map<EntityId, unknown>
        store.set(key.name, map)
      }
      map.set(id, data)
    },
    removeComponent(id, key) {
      const map = store.get(key.name)
      if (map) map.delete(id)
    },
    entitiesWith<TData, TEntity extends EntityId>(
      key: ComponentKey<TData, TEntity>
    ): TEntity[] {
      const map = store.get(key.name)
      if (!map) return []
      return Array.from(map.keys()) as TEntity[]
    }
  }
}
