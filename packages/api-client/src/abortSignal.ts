export function combineAbortSignals(
  signals: readonly AbortSignal[]
): AbortSignal {
  if (typeof AbortSignal.any === 'function')
    return AbortSignal.any([...signals])

  const controller = new AbortController()
  const aborted = signals.find((signal) => signal.aborted)
  if (aborted) {
    controller.abort(aborted.reason)
    return controller.signal
  }

  const listeners: Array<{ signal: AbortSignal; abort: () => void }> = []
  for (const signal of signals) {
    const abort = () => {
      for (const listener of listeners)
        listener.signal.removeEventListener('abort', listener.abort)
      controller.abort(signal.reason)
    }
    listeners.push({ signal, abort })
    signal.addEventListener('abort', abort, { once: true })
  }
  return controller.signal
}

export function createTimeoutSignal(milliseconds: number): AbortSignal {
  if (typeof AbortSignal.timeout === 'function')
    return AbortSignal.timeout(milliseconds)

  const controller = new AbortController()
  setTimeout(
    () =>
      controller.abort(
        new DOMException('The operation timed out.', 'TimeoutError')
      ),
    milliseconds
  )
  return controller.signal
}

/** Native `signal.throwIfAborted()` is missing on Chrome < 100 and Safari < 15.4. */
export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return
  throw signal.reason === undefined
    ? new DOMException('This operation was aborted', 'AbortError')
    : signal.reason
}

/** Stops waiting on an operation whose underlying API does not accept a signal. */
export function awaitWithAbort<T>(
  operation: Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  if (!signal) return operation
  return new Promise((resolve, reject) => {
    const onAbort = () =>
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
    if (signal.aborted) onAbort()
    else signal.addEventListener('abort', onAbort, { once: true })
    void operation
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', onAbort))
  })
}
