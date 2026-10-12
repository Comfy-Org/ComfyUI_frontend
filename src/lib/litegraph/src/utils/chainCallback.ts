export type ChainedCallback<O, T> =
  NonNullable<T> extends (this: O, ...args: infer P) => unknown
    ? (this: O, ...args: P) => void
    : never

interface CallbackChain {
  originalCallback: Callable | undefined
  callbacks: readonly Callable[]
}

export type Callable = (...args: never[]) => unknown
type CallbackSignature<T extends Callable> = T extends (
  this: infer O,
  ...args: infer P
) => infer R
  ? (this: O, ...args: P) => R
  : never

const callbackChains = new WeakMap<Callable, CallbackChain>()

function chainCallbacks(
  originalCallback: Callable | undefined,
  callbacks: readonly Callable[]
): Callable {
  const chained = function (this: unknown, ...args: never[]) {
    let result: unknown
    if (originalCallback) {
      result = Reflect.apply(originalCallback, this, args)
    }
    for (const callback of callbacks) {
      Reflect.apply(callback, this, args)
    }
    return result
  }

  callbackChains.set(chained, { originalCallback, callbacks })
  return chained
}

export function chainCallback<O, T extends Callable>(
  originalCallback: T | undefined,
  ...callbacks: ChainedCallback<O, T>[]
) {
  type Args = NonNullable<T> extends (...args: infer P) => unknown ? P : never
  type Ret = NonNullable<T> extends (...args: unknown[]) => infer R ? R : never

  return chainCallbacks(originalCallback, callbacks) as (
    this: O,
    ...args: Args
  ) => Ret
}

export function rebaseChainCallback<T extends Callable>(
  currentCallback: T | undefined,
  previousOriginal: T | undefined,
  nextOriginal: T | undefined
): CallbackSignature<T> | undefined
export function rebaseChainCallback(
  currentCallback: Callable | undefined,
  previousOriginal: Callable | undefined,
  nextOriginal: Callable | undefined
): Callable | undefined {
  if (previousOriginal === nextOriginal) return currentCallback
  if (!currentCallback) return nextOriginal

  const appendedCallbacks: Callable[] = []
  let original: Callable | undefined = currentCallback
  while (original !== previousOriginal) {
    if (!original) break
    const chain = callbackChains.get(original)
    if (!chain) {
      return chainCallbacks(nextOriginal, [currentCallback])
    }
    appendedCallbacks.unshift(...chain.callbacks)
    original = chain.originalCallback
  }

  if (original === previousOriginal) {
    return chainCallbacks(nextOriginal, appendedCallbacks)
  }

  return chainCallbacks(nextOriginal, [currentCallback])
}
