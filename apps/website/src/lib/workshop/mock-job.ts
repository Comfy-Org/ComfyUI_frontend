/**
 * A stand-in for a backend job: settles with `answer` after `delayMs`, or
 * rejects as soon as `signal` aborts.
 */
export function mockJob<T>(
  answer: T,
  signal: AbortSignal,
  delayMs: number
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason)
      return
    }
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal.reason)
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve(answer)
    }, delayMs)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}
