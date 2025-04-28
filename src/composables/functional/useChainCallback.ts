/**
 * Shorthand for {@link Parameters} of optional callbacks.
 *
 * @example
 * ```ts
 * const { onClick } = CustomClass.prototype
 * CustomClass.prototype.onClick = function (...args: CallbackParams<typeof onClick>) {
 *   const r = onClick?.apply(this, args)
 *   // ...
 *   return r
 * }
 * ```
 */
export type CallbackParams<T extends ((...args: any) => any) | undefined> =
  Parameters<Exclude<T, undefined>>

/**
 * Chain multiple callbacks together.
 *
 * @param originalCallback - The original callback to chain.
 * @param callbacks - The callbacks to chain.
 * @returns A new callback that chains the original callback with the callbacks.
 */
export const useChainCallback = <
  O,
  T extends (this: O, ...args: any[]) => void
>(
  originalCallback: T | undefined,
  ...callbacks: ((this: O, ...args: Parameters<T>) => void)[]
) => {
  return function (this: O, ...args: Parameters<T>) {
    originalCallback?.call(this, ...args)
    for (const callback of callbacks) callback.call(this, ...args)
  }
}
