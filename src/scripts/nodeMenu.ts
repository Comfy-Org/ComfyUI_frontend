const closureCallbacks = new WeakSet<object>()

/** Declares a callback that needs no legacy arguments, DOM receiver, or keep-open return value. */
export function closureOnly<T extends () => void>(callback: T): T {
  closureCallbacks.add(callback)
  return callback
}

export function isClosureOnly(callback: object): boolean {
  return closureCallbacks.has(callback)
}
