import { reactive } from 'vue'

import type { ComponentKey } from './componentKey'
import type { EntityId } from './entityIds'

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
  hasComponent<TData, TEntity extends EntityId>(
    id: TEntity,
    key: ComponentKey<TData, TEntity>
  ): boolean
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
  ): IterableIterator<TEntity>
}

interface InternalStore {
  store: Map<string, Map<EntityId, unknown>>
}

function getOrCreateMap(
  internal: InternalStore,
  keyName: string
): Map<EntityId, unknown> {
  const existing = internal.store.get(keyName)
  if (existing) return existing
  const next = reactive(new Map<EntityId, unknown>()) as Map<EntityId, unknown>
  internal.store.set(keyName, next)
  return next
}

export function createWorld(): World {
  const internal: InternalStore = { store: new Map() }

  return {
    getComponent<TData, TEntity extends EntityId>(
      id: TEntity,
      key: ComponentKey<TData, TEntity>
    ): TData | undefined {
      const map = internal.store.get(key.name)
      if (!map) return undefined
      return map.get(id) as TData | undefined
    },
    hasComponent(id, key) {
      const map = internal.store.get(key.name)
      return map ? map.has(id) : false
    },
    setComponent(id, key, data) {
      const map = getOrCreateMap(internal, key.name)
      map.set(id, data)
    },
    removeComponent(id, key) {
      const map = internal.store.get(key.name)
      if (map) map.delete(id)
    },
    *entitiesWith(key) {
      const map = internal.store.get(key.name)
      if (!map) return
      for (const id of map.keys()) yield id as never
    }
  }
}
