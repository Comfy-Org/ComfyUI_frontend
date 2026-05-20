export function createRafBatch(run: () => void) {
  let rafId: number | null = null

  function schedule() {
    if (rafId != null) return
    rafId = requestAnimationFrame(() => {
      rafId = null
      run()
    })
  }

  function cancel() {
    if (rafId != null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  function flush() {
    if (rafId == null) return
    cancelAnimationFrame(rafId)
    rafId = null
    run()
  }

  function isScheduled() {
    return rafId != null
  }

  return { schedule, cancel, flush, isScheduled }
}
