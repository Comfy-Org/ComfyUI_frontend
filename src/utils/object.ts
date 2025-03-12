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
  // Assertion: Required to avoid verbose runtime guards
  const picked = {} as Pick<T, K>
  for (const key of keys) {
    if (key in obj) {
      picked[key] = obj[key]
    }
  }
  return picked
}
