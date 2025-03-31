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
    callbacks.forEach((callback) => callback.call(this, ...args))
  }
}
