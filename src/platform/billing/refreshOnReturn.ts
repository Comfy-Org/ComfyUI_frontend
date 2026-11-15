/**
 * Runs `refresh` on each return to this tab or window; a return during a
 * refresh in flight gets one trailing refresh. Returns how to disarm it.
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
