interface CallbackChain {
  originalCallback: Callable | undefined
  callbacks: readonly Callable[]
}

type Callable = (...args: never[]) => unknown
type CleanupCallback = () => void

const callbackChains = new WeakMap<Callable, CallbackChain>()

export function chainCallback<O, Args extends unknown[], Result = void>(
  originalCallback: ((this: O, ...args: Args) => Result) | undefined,
  ...callbacks: ((this: O, ...args: Args) => void)[]
) {
  function chained(this: O, ...args: Args) {
    const result = originalCallback?.apply(this, args)
    for (const callback of callbacks) {
      callback.apply(this, args)
    }
    return result
  }

  callbackChains.set(chained, { originalCallback, callbacks })
  return chained
}

export function rebaseChainCallback(
  currentCallback: CleanupCallback | undefined,
  previousOriginal: CleanupCallback | undefined,
  nextOriginal: CleanupCallback | undefined
): CleanupCallback | undefined {
  if (previousOriginal === nextOriginal) return currentCallback
  if (!currentCallback) return nextOriginal

  const appendedCallbacks: Callable[] = []
  let link: Callable | undefined = currentCallback
  while (link !== previousOriginal) {
    const chain: CallbackChain | undefined = link && callbackChains.get(link)
    if (!chain) {
      return chainCallback(nextOriginal, currentCallback)
    }
    appendedCallbacks.unshift(...chain.callbacks)
    link = chain.originalCallback
  }
  return chainCallback(nextOriginal, ...appendedCallbacks)
}
