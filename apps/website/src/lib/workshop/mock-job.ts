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
    const timer = setTimeout(() => resolve(answer), delayMs)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(signal.reason)
    })
  })
}
