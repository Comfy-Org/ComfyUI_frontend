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
 */
export function createRafCoalescer<T>(apply: (value: T) => void) {
  let hasPending = false
  let pendingValue: T | undefined

  const batch = createRafBatch(() => {
    if (!hasPending) return
    const value = pendingValue as T
    hasPending = false
    pendingValue = undefined
    apply(value)
  })

  const push = (value: T) => {
    pendingValue = value
    hasPending = true
    batch.schedule()
  }

  const cancel = () => {
    hasPending = false
    pendingValue = undefined
    batch.cancel()
  }

  const flush = () => {
    if (!hasPending) return
    batch.flush()
  }

  return { push, cancel, flush, isScheduled: batch.isScheduled }
}
