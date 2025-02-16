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
  return (...args: Parameters<T>) => {
    originalCallback?.(...args)
    callbacks.forEach((callback) => callback(...args))
  }
}
