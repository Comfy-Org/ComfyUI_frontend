/**
 * @example
 * ```ts
 * type WidgetEntityId = Brand<string, 'WidgetEntityId'>
 * const bad: WidgetEntityId = 'arbitrary string' // ❌ type error
 * ```
 */
export type Brand<T, Tag extends string> = T & { readonly __brand: Tag }
