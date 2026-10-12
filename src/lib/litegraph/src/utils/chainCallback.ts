export type ChainedCallback<O, T> =
  NonNullable<T> extends (this: O, ...args: infer P) => unknown
    ? (this: O, ...args: P) => void
    : never

interface CallbackChain {
  originalCallback: unknown
  callbacks: readonly unknown[]
}

const callbackChains = new WeakMap<object, CallbackChain>()

/**
 * Chain multiple callbacks together.
 *
 * @param originalCallback - The original callback to chain.
 * @param callbacks - The callbacks to chain.
 * @returns A new callback that chains the original callback with the callbacks.
 */
export function chainCallback<O, T>(
  originalCallback: T | undefined,
  ...callbacks: ChainedCallback<O, T>[]
) {
  type Args = NonNullable<T> extends (...args: infer P) => unknown ? P : never
  type Ret = NonNullable<T> extends (...args: unknown[]) => infer R ? R : never

  const chainedCallback = function (this: O, ...args: Args) {
    if (typeof originalCallback === 'function') {
      ;(originalCallback as (this: O, ...args: Args) => Ret).call(this, ...args)
    }
    for (const callback of callbacks) {
      callback.call(this, ...args)
    }
  } as (this: O, ...args: Args) => Ret

  callbackChains.set(chainedCallback, { originalCallback, callbacks })
  return chainedCallback
}

/**
 * Move a callback chain to a replacement owner without retaining its stale
 * original callback or losing callbacks appended by consumers.
 */
export function rebaseChainCallback<T>(
  currentCallback: T | undefined,
  previousOriginal: T | undefined,
  nextOriginal: T | undefined
): T | undefined {
  const rebaseKnownChain = (
    callback: T | undefined
  ): { callback: T | undefined; found: boolean } => {
    if (callback === previousOriginal) {
      return { callback: nextOriginal, found: true }
    }
    if (typeof callback !== 'function') return { callback, found: false }

    const chain = callbackChains.get(callback)
    if (!chain) return { callback, found: false }
    const rebasedOriginal = rebaseKnownChain(
      chain.originalCallback as T | undefined
    )
    if (!rebasedOriginal.found) return { callback, found: false }

    return {
      callback: chainCallback<unknown, T>(
        rebasedOriginal.callback,
        ...(chain.callbacks as ChainedCallback<unknown, T>[])
      ) as T,
      found: true
    }
  }

  const rebased = rebaseKnownChain(currentCallback)
  if (rebased.found) return rebased.callback
  if (typeof currentCallback !== 'function') return nextOriginal

  return chainCallback<unknown, T>(
    nextOriginal,
    currentCallback as ChainedCallback<unknown, T>
  ) as T
}
