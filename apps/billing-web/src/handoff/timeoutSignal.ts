/** Native `AbortSignal.timeout` is missing on Chrome < 103 and Safari < 16. */
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
