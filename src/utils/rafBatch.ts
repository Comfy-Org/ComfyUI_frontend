export function createRafBatch(run: () => void) {
  let rafId: number | null = null

  const schedule = () => {
    if (rafId != null) return
    rafId = requestAnimationFrame(() => {
      rafId = null
      run()
    })
  }

  const cancel = () => {
    if (rafId != null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  const flush = () => {
    if (rafId == null) return
    cancelAnimationFrame(rafId)
    rafId = null
    run()
  }

  const isScheduled = () => rafId != null

  return { schedule, cancel, flush, isScheduled }
}

/**
 * Last-write-wins RAF coalescer. Buffers the latest value and applies it
 * on the next animation frame, coalescing multiple pushes into a single
 * reactive update.
 *
 * Pass a `label` to emit `performance.mark` events in dev mode so the
 * batching benefit is visible in the browser profiler under that name.
 */
export function createRafCoalescer<T>(
  apply: (value: T) => void,
  label?: string
) {
  let hasPending = false
  let pendingValue: T | undefined
  let droppedCount = 0

  const batch = createRafBatch(() => {
    if (!hasPending) return
    const value = pendingValue as T
    if (import.meta.env.DEV && label) {
      performance.mark(`${label}:apply`, {
        detail: { dropped: droppedCount }
      })
    }
    droppedCount = 0
    hasPending = false
    pendingValue = undefined
    apply(value)
  })

  const push = (value: T) => {
    if (hasPending) droppedCount++
    pendingValue = value
    hasPending = true
    batch.schedule()
  }

  const cancel = () => {
    droppedCount = 0
    hasPending = false
    pendingValue = undefined
    batch.cancel()
  }

  return { push, cancel, isScheduled: batch.isScheduled }
}
