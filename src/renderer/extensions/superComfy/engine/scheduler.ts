import type { NodeId } from './documentSchema'

interface ReadinessOptions {
  order: NodeId[]
  upstreamOf: (id: NodeId) => NodeId[]
  start: (id: NodeId) => Promise<void>
  maxParallel: number
  signal: AbortSignal
}

export function scheduleByReadiness(opts: ReadinessOptions): Promise<void> {
  const { order, upstreamOf, start, maxParallel, signal } = opts
  const scheduled = new Set(order)
  const launched = new Set<NodeId>()
  const settled = new Set<NodeId>()
  const limit = Math.max(1, maxParallel)
  let running = 0
  let failure: { error: unknown } | null = null

  const isReady = (id: NodeId) =>
    upstreamOf(id).every(
      (upstream) => !scheduled.has(upstream) || settled.has(upstream)
    )

  return new Promise<void>((resolve, reject) => {
    const pump = () => {
      for (const id of order) {
        if (signal.aborted || running >= limit) break
        if (launched.has(id) || !isReady(id)) continue
        launched.add(id)
        running += 1
        void new Promise<void>((done) => done(start(id)))
          .catch((error: unknown) => {
            failure ??= { error }
          })
          .finally(() => {
            running -= 1
            settled.add(id)
            pump()
          })
      }
      if (running > 0) return
      if (failure) reject(failure.error)
      else resolve()
    }
    pump()
  })
}

export async function mapWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<void>,
  signal: AbortSignal
): Promise<void> {
  let next = 0
  const worker = async () => {
    while (!signal.aborted && next < items.length) {
      const item = items[next]
      next += 1
      await fn(item)
    }
  }
  const workers = Math.max(1, Math.min(limit, items.length))
  await Promise.all(Array.from({ length: workers }, worker))
}
