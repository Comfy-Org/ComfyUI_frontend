/**
 * Compile-time nominal typing primitive.
 *
 * `Brand<T, Tag>` makes a structurally-equivalent type incompatible with `T`
 * unless explicitly constructed by a designated factory. This catches bugs
 * where an arbitrary string or number is silently used where a domain-specific
 * identifier is expected.
 *
 * Usage:
 * ```ts
 * type WidgetEntityId = Brand<string, 'WidgetEntityId'>
 * declare function widgetEntityId(graphId: string, nodeId: NodeId, name: string): WidgetEntityId
 *
 * const id: WidgetEntityId = widgetEntityId(g, n, 'seed')
 * const bad: WidgetEntityId = 'arbitrary string' // ❌ type error
 * ```
 *
 * The phantom property is non-enumerable at runtime; `Brand<T, Tag>` is
 * structurally `T`. Cast back to `T` is safe and free.
 */
export type Brand<T, Tag extends string> = T & { readonly __brand: Tag }
