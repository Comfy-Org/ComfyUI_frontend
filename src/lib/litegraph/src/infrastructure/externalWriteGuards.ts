export type RefusedWriteReporter = (key: string, value: unknown) => void

function readCoordinates(value: unknown, arity: number): number[] | undefined {
  if (
    value === null ||
    (typeof value !== 'object' && typeof value !== 'function')
  )
    return undefined

  const coords: number[] = []
  for (let index = 0; index < arity; index++) {
    let coord: unknown
    try {
      coord = Reflect.get(value, index)
    } catch {
      return undefined
    }
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
function acceptsWithoutThrowing<TAccepted>(
  accepts: (value: unknown) => value is TAccepted,
  value: unknown
): value is TAccepted {
  try {
    return accepts(value)
  } catch {
    return false
  }
}

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
      if (acceptsWithoutThrowing(accepts, value)) current = value
      else onRefused(key, value)
    },
    enumerable: true,
    configurable: true
  })
}
