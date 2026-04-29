import { reactive, shallowReactive } from 'vue'

import type { ComponentKey } from './componentKey'
import type { EntityId } from './entityIds'

/**
 * `setComponent` stores by reference; `getComponent` returns a Vue proxy
 * cached per `(id, key)`. The proxy is stable across reads and is NOT
 * `===` to the input. Treat `getComponent` as the canonical read path.
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
  // shallowReactive so first-bucket creation is observable to subscribers.
  const store = shallowReactive(new Map<string, Map<EntityId, unknown>>())

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
