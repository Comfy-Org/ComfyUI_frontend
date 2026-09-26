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
