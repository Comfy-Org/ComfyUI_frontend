/**
 * Guards for fields that outside code assigns to directly.
 *
 * Extensions copy an entity by enumerating its own keys - a JSON round-trip, a
 * deep clone with no typed-array branch - and write the copy back. That
 * replaces a `Rectangle` with `{"0":x,"1":y}` and a `Set` with `{}`, after
 * which every later read throws. These guards keep the original object and
 * take the assigned value's contents instead, so such a write degrades to a
 * no-op rather than breaking the entity.
 */

/** Reports a write that was refused, so the caller can be identified. */
export type RefusedWriteReporter = (key: string, value: unknown) => void

function readCoordinates(value: unknown, arity: number): number[] | undefined {
  const source = value as ArrayLike<unknown> | null | undefined
  const coords: number[] = []
  for (let index = 0; index < arity; index++) {
    const coord = source?.[index]
    if (typeof coord !== 'number' || !Number.isFinite(coord)) return undefined
    coords.push(coord)
  }
  return coords
}

/**
 * Redefines `key` so assignment copies coordinates into the existing buffer
 * rather than replacing it. Anything that is not {@link arity} finite numbers
 * is refused.
 */
export function defineAbsorbingBuffer(
  target: object,
  key: string,
  arity: number,
  write: (coords: number[]) => void,
  onRefused: RefusedWriteReporter
): void {
  const buffer: unknown = Reflect.get(target, key)
  Object.defineProperty(target, key, {
    get: () => buffer,
    set: (value: unknown) => {
      const coords = readCoordinates(value, arity)
      if (!coords) {
        onRefused(key, value)
        return
      }
      write(coords)
    },
    enumerable: true,
    configurable: true
  })
}

/**
 * Redefines `key` so only a value {@link accepts} recognises can replace the
 * current collection.
 */
export function defineGuardedCollection<
  TTarget extends object,
  TKey extends keyof TTarget & string
>(
  target: TTarget,
  key: TKey,
  accepts: (value: unknown) => value is TTarget[TKey],
  onRefused: RefusedWriteReporter
): void {
  let current = target[key]
  Object.defineProperty(target, key, {
    get: () => current,
    set: (value: unknown) => {
      if (accepts(value)) current = value
      else onRefused(key, value)
    },
    enumerable: true,
    configurable: true
  })
}
