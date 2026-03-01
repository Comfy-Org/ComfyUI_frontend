/**
 * Recursively converts a snake_case string to camelCase at the type level.
 *
 * @see https://jsdev.space/camelcase-ts/
 */
export type CamelCase<S> =
  S extends `${infer First}_${infer SecondFirst}${infer Rest}`
    ? `${First}${Uppercase<SecondFirst>}${CamelCase<Rest>}`
    : S

/**
 * Recursively transforms all keys in an object type from snake_case to
 * camelCase, including nested objects and arrays.
 */
export type KeysToCamelCase<T> =
  T extends Record<string, unknown>
    ? { [K in keyof T as CamelCase<K>]: KeysToCamelCase<T[K]> }
    : T extends Array<infer U>
      ? Array<KeysToCamelCase<U>>
      : T
