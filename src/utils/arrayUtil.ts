/** ES2022-safe equivalent of `Array.prototype.findLastIndex`. */
export function findLastIndex<T>(
  array: readonly T[],
  predicate: (value: T, index: number, array: readonly T[]) => unknown
): number {
  for (let index = array.length - 1; index >= 0; index--) {
    if (predicate(array[index], index, array)) return index
  }
  return -1
}

/** ES2022-safe equivalent of `Array.prototype.findLast`. */
export function findLast<T>(
  array: readonly T[],
  predicate: (value: T, index: number, array: readonly T[]) => unknown
): T | undefined {
  for (let index = array.length - 1; index >= 0; index--) {
    const value = array[index]
    if (predicate(value, index, array)) return value
  }
  return undefined
}
