/**
 * @example
 * ```ts
 * type WidgetId = Brand<string, 'WidgetId'>
 * const bad: WidgetId = 'arbitrary string' // ❌ type error
 * ```
 */
export type Brand<T, Tag extends string> = T & { readonly __brand: Tag }
