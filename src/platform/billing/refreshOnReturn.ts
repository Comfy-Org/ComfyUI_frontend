/**
 * Runs `refresh` with each return to this tab, plus one for a return that lands
 * mid-refresh. The returned function disarms it and drops that queued one.
 */
export function registerRefreshOnReturn(
  refresh: (returned: Event) => Promise<unknown>
): () => void {
  let away = true
  let inFlight = false
  let queued: Event | undefined

  const run = (returned: Event) => {
    inFlight = true
    void refresh(returned).finally(() => {
      inFlight = false
      const next = queued
      queued = undefined
      if (next) run(next)
    })
  }
  const onLeave = () => {
    away = true
  }
  const onReturn = (returned: Event) => {
    if (!away) return
    away = false
    if (inFlight) {
      queued = returned
      return
    }
    run(returned)
  }
  const onVisibilityChange = (event: Event) => {
    if (document.visibilityState === 'visible') onReturn(event)
    else onLeave()
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('focus', onReturn)
  window.addEventListener('blur', onLeave)
  return () => {
    queued = undefined
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('focus', onReturn)
    window.removeEventListener('blur', onLeave)
  }
}
