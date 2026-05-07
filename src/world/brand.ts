/**
 * Nominal-typed brand helper. Used by entity ID and component-key types so
 * mixing kinds is a compile-time error.
 */
declare const brand: unique symbol
export type Brand<T, Tag extends string> = T & { readonly [brand]: Tag }
