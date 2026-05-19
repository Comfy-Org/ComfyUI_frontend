/**
 * Compile-time nominal typing primitive. `Brand<T, Tag>` is structurally `T`
 * (the phantom property is type-only), but assignment from a plain `T` is
 * rejected — values must come from a designated factory.
 *
 * @example
 * ```ts
 * type WidgetEntityId = Brand<string, 'WidgetEntityId'>
 * const bad: WidgetEntityId = 'arbitrary string' // ❌ type error
 * ```
 */
export type Brand<T, Tag extends string> = T & { readonly __brand: Tag }
