/**
 * Runs `refresh` on each return to this tab, plus one if a return lands
 * mid-refresh. The returned function disarms it and drops that queued one.
 */
export function registerRefreshOnReturn(
  refresh: () => Promise<unknown>
): () => void {
  let away = true
  let inFlight = false
  let trailing = false

  const run = () => {
    inFlight = true
    void refresh().finally(() => {
      inFlight = false
      if (!trailing) return
      trailing = false
      run()
    })
  }
  const onLeave = () => {
    away = true
  }
  const onReturn = () => {
    if (!away) return
    away = false
    if (inFlight) {
      trailing = true
      return
    }
    run()
  }
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') onReturn()
    else onLeave()
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('focus', onReturn)
  window.addEventListener('blur', onLeave)
  return () => {
    trailing = false
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('focus', onReturn)
    window.removeEventListener('blur', onLeave)
  }
}
