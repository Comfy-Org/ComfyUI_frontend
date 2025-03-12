export function omitBy<T extends object>(obj: T, predicate: (value: any) => boolean): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_key, value]) => !predicate(value)),
  ) as Partial<T>
}

/**
 * Creates an object composed of the picked object properties.
 * Similar to lodash's pick function.
 * @param obj The source object
 * @param keys The property names to pick
 * @returns A new object with just the picked properties
 */
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  // eslint-disable-next-line unicorn/no-array-reduce
  return keys.reduce((result, key) => {
    if (key in obj) {
      result[key] = obj[key]
    }
    return result
  }, {} as Pick<T, K>)
}
