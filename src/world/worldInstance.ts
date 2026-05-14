// Phase A stub — replaced by real ECS world when PR #11939 lands.
// Tests mock this module via vi.mock('@/world/worldInstance').

import type { ComponentKey } from './componentKey'
import type { EntityId } from './entityIds'

/**
 * ECS World contract. Internal only — not part of public extension API.
 * Phase A surface; replaced by Alex's PR #11939 (ECS substrate slice 2).
 */
interface World {
  getComponent<TData, TEntity extends EntityId>(
    entityId: TEntity,
    key: ComponentKey<TData, TEntity>
  ): TData | undefined
  setComponent<TData, TEntity extends EntityId>(
    entityId: TEntity,
    key: ComponentKey<TData, TEntity>,
    data: TData
  ): void
  removeComponent<TData, TEntity extends EntityId>(
    entityId: TEntity,
    key: ComponentKey<TData, TEntity>
  ): void
  entitiesWith<TData, TEntity extends EntityId>(
    key: ComponentKey<TData, TEntity>
  ): TEntity[]
}

export function getWorld(): World {
  throw new Error(
    '[worldInstance] ECS world not yet initialized (Phase A stub)'
  )
}
