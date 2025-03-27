/**
 * Chain multiple callbacks together.
 *
 * @param originalCallback - The original callback to chain.
 * @param callbacks - The callbacks to chain.
 * @returns A new callback that chains the original callback with the callbacks.
 */
export const useChainCallback = <T extends (...args: any[]) => void>(
  originalCallback: T | undefined,
  ...callbacks: ((...args: Parameters<T>) => void)[]
) => {
  return function (this: unknown, ...args: Parameters<T>) {
    originalCallback?.call(this, ...args)
    callbacks.forEach((callback) => callback.call(this, ...args))
  }
}
