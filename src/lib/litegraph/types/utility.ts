/**
 * General-purpose TypeScript utility types for litegraph.
 * These have no dependencies on runtime code.
 */

export type Dictionary<T> = { [key: string]: T }

/** Allows all properties to be null.  The same as `Partial<T>`, but adds null instead of undefined. */
export type NullableProperties<T> = {
  [P in keyof T]: T[P] | null
}

/**
 * If {@link T} is `null` or `undefined`, evaluates to {@link Result}. Otherwise, evaluates to {@link T}.
 * Useful for functions that return e.g. `undefined` when a param is nullish.
 */
export type WhenNullish<T, Result> =
  | (T & {})
  | (T extends null ? Result : T extends undefined ? Result : T & {})

/** A type with each of the {@link Properties} made optional. */
export type OptionalProps<T, Properties extends keyof T> = Omit<
  T,
  Properties
> & { [K in Properties]?: T[K] }

/** A type with each of the {@link Properties} marked as required. */
export type RequiredProps<T, Properties extends keyof T> = Omit<
  T,
  Properties
> & { [K in Properties]-?: T[K] }

/** Bitwise AND intersection of two types; returns a new, non-union type that includes only properties that exist on both types. */
export type SharedIntersection<T1, T2> = {
  [P in keyof T1 as P extends keyof T2 ? P : never]: T1[P]
} & {
  [P in keyof T2 as P extends keyof T1 ? P : never]: T2[P]
}

/** Union of property names that are of type Match */
type KeysOfType<T, Match> = Exclude<
  { [P in keyof T]: T[P] extends Match ? P : never }[keyof T],
  undefined
>

/** The names of all (optional) methods and functions in T */
export type MethodNames<T> = KeysOfType<
  T,
  ((...args: unknown[]) => unknown) | undefined
>

/** {@link Pick} only properties that evaluate to `never`. */
export type PickNevers<T> = {
  [K in keyof T as T[K] extends never ? K : never]: T[K]
}

/** {@link Omit} all properties that evaluate to `never`. */
export type NeverNever<T> = {
  [K in keyof T as T[K] extends never ? never : K]: T[K]
}
