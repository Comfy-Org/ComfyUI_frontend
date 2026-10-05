/**
 * A cancellation, card change, or payment made in a hosted tab never pushes
 * back to this one, so every return to this tab re-reads whatever that tab
 * could have changed. A return is leaving (`blur` or hidden) and coming back
 * (`focus` or visible): the focus and visibility events of one return count
 * once, and a return that lands while a refresh is still in flight gets one
 * trailing refresh, because that read may predate what the hosted tab just
 * did. It stays armed until the returned callback runs. Shared by every
 * opener of a hosted billing tab or window so they arm the same return
 * signal one way.
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
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('focus', onReturn)
    window.removeEventListener('blur', onLeave)
  }
}
