import type { EntityId } from './entityIds'

declare const componentKeyData: unique symbol
declare const componentKeyEntity: unique symbol

/**
 * Nominal handle for a component type. The phantom params drive
 * `world.getComponent` return-type inference and forbid cross-kind misuse
 * (e.g. reading a `WidgetValue` off a `NodeEntityId` is a type error).
 */
export interface ComponentKey<TData, TEntity extends EntityId> {
  readonly name: string
  readonly [componentKeyData]?: TData
  readonly [componentKeyEntity]?: TEntity
}

const registeredNames = new Set<string>()

export function defineComponentKey<TData, TEntity extends EntityId>(
  name: string
): ComponentKey<TData, TEntity> {
  if (import.meta.env.DEV && registeredNames.has(name)) {
    console.error(
      `[world] ComponentKey name collision: "${name}" was already registered. ` +
        `Two keys with the same name share storage and will silently overwrite each other.`
    )
  }
  registeredNames.add(name)
  return { name } as ComponentKey<TData, TEntity>
}
