import { setTimeout } from 'node:timers/promises'

export function createStartGate(startsPerSecond: number) {
  if (!Number.isFinite(startsPerSecond) || startsPerSecond <= 0)
    throw new Error('Starts per second must be positive')
  let next = 0
  return async function wait(signal: AbortSignal) {
    signal.throwIfAborted()
    const start = Math.max(Date.now(), next)
    next = start + 1000 / startsPerSecond
    if (start > Date.now())
      await setTimeout(start - Date.now(), undefined, { signal })
    signal.throwIfAborted()
  }
}

export async function mapConcurrent<T, R>(
  items: readonly T[],
  concurrency: number,
  run: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1)
    throw new Error('Concurrency must be a positive integer')
  const results: R[] = []
  let next = 0
  let failed = false
  async function worker() {
    while (!failed && next < items.length) {
      const index = next++
      try {
        results[index] = await run(items[index], index)
      } catch (error) {
        failed = true
        throw error
      }
    }
  }
  const workers = await Promise.allSettled(
    Array.from({ length: Math.min(concurrency, items.length) }, worker)
  )
  const failure = workers.find((result) => result.status === 'rejected')
  if (failure?.status === 'rejected') throw failure.reason
  return results
}
