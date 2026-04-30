import type { EntityId } from './entityIds'

declare const componentKeyData: unique symbol
declare const componentKeyEntity: unique symbol
declare const slotData: unique symbol
declare const slotEntity: unique symbol

/**
 * Nominal handle for a component type. The phantom params drive
 * `world.getComponent` return-type inference and forbid cross-kind misuse
 * (e.g. reading a `WidgetValue` off a `NodeEntityId` is a type error).
 *
 * `TName` carries the registered name as a string literal type when the key
 * was produced via `defineComponentKeys`. For one-off `defineComponentKey`
 * calls it widens to `string`.
 */
export interface ComponentKey<
  TData,
  TEntity extends EntityId,
  TName extends string = string
> {
  readonly name: TName
  readonly [componentKeyData]?: TData
  readonly [componentKeyEntity]?: TEntity
}

/**
 * Phantom slot used as the per-property argument to `defineComponentKeys`.
 * `slot<TData, TEntity>()` returns an empty object whose phantom symbols
 * carry the data + entity types so the factory can recover them via `infer`.
 */
interface Slot<TData, TEntity extends EntityId> {
  readonly [slotData]?: TData
  readonly [slotEntity]?: TEntity
}

export const slot = <TData, TEntity extends EntityId>(): Slot<TData, TEntity> =>
  ({}) as Slot<TData, TEntity>

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

/**
 * Define a related set of `ComponentKey`s under a shared prefix in one call.
 *
 * The full registered name for each key is `${TPrefix}Component${ShortName}`,
 * derived from both the runtime prefix and the property keys of the slots
 * object. The literal-type return signature mirrors that string so each key
 * carries its full name as a string literal type.
 *
 * Internally calls `defineComponentKey` per slot, so the dev-time collision
 * warning still fires for factory-created keys.
 */
export function defineComponentKeys<
  TPrefix extends string,
  TSlots extends Record<string, Slot<unknown, EntityId>>
>(
  prefix: TPrefix,
  slots: TSlots
): {
  [K in keyof TSlots &
    string as `${TPrefix}Component${K}`]: TSlots[K] extends Slot<
    infer TData,
    infer TEntity
  >
    ? ComponentKey<TData, TEntity, `${TPrefix}Component${K}`>
    : never
} {
  const result = {} as Record<string, ComponentKey<unknown, EntityId>>
  for (const shortName of Object.keys(slots)) {
    const fullName = `${prefix}Component${shortName}`
    result[fullName] = defineComponentKey<unknown, EntityId>(fullName)
  }
  return result as never
}
