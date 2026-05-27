import { reactive, shallowReactive } from 'vue'

import type { ComponentKey } from './componentKey'
import type { EntityId } from './entityIds'

/**
 * `setComponent` stores by reference; `getComponent` returns a Vue proxy
 * cached per `(id, key)`. The proxy is stable across reads and is NOT
 * `===` to the input. Treat `getComponent` as the canonical read path.
 *
 * Component buckets are keyed by `ComponentKey` reference identity, NOT by
 * `key.name`. Two distinct keys with the same `name` string therefore do
 * not share storage. `key.name` remains useful for debugging only.
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

interface AnyComponentKey extends ComponentKey<unknown, EntityId> {}
interface AnyBucket extends Map<EntityId, unknown> {}
interface Bucket<TData, TEntity extends EntityId> extends Map<TEntity, TData> {}

export function createWorld(): World {
  // shallowReactive so first-bucket creation is observable to subscribers.
  const store = shallowReactive(new Map<AnyComponentKey, AnyBucket>())

  /**
   * The single existential erasure boundary. The phantom `TData`/`TEntity`
   * params on `ComponentKey` are not representable in the heterogeneous outer
   * `Map`, so we erase here and reify in `getBucket`.
   */
  function eraseKey<TData, TEntity extends EntityId>(
    key: ComponentKey<TData, TEntity>
  ): AnyComponentKey {
    return key as AnyComponentKey
  }

  /**
   * Invariant (audited at this boundary only): for a given
   * `ComponentKey<TData, TEntity>`, the stored bucket is absent or a
   * `Map<TEntity, TData>` created and mutated only through this world.
   */
  function getBucket<TData, TEntity extends EntityId>(
    key: ComponentKey<TData, TEntity>
  ): Bucket<TData, TEntity> | undefined {
    return store.get(eraseKey(key)) as Bucket<TData, TEntity> | undefined
  }

  function getOrCreateBucket<TData, TEntity extends EntityId>(
    key: ComponentKey<TData, TEntity>
  ): Bucket<TData, TEntity> {
    const existing = getBucket(key)
    if (existing) return existing
    // `reactive()` widens the bucket's value type to `UnwrapRefSimple<TData>`;
    // `TData` is a generic so TS can't prove they coincide. Cast confined here.
    const created = reactive(new Map<TEntity, TData>()) as Bucket<
      TData,
      TEntity
    >
    store.set(eraseKey(key), created as AnyBucket)
    return created
  }

  return {
    getComponent(id, key) {
      return getBucket(key)?.get(id)
    },
    setComponent(id, key, data) {
      getOrCreateBucket(key).set(id, data)
    },
    removeComponent(id, key) {
      getBucket(key)?.delete(id)
    },
    entitiesWith(key) {
      const bucket = getBucket(key)
      return bucket ? Array.from(bucket.keys()) : []
    }
  }
}
