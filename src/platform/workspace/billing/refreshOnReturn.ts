/**
 * A cancellation, card change, or payment made in a hosted tab never pushes
 * back to this one, so every `focus`/`visibilitychange` re-reads whatever
 * that tab could have changed. It stays armed until the returned callback
 * runs: a return before the hosted tab finishes must not spend the refresh
 * the customer needs after it. Shared by every opener of a hosted billing
 * tab or window so they arm the same return signal one way.
 */
export function registerRefreshOnReturn(
  refresh: () => Promise<unknown>
): () => void {
  let inFlight = false
  const onReturn = (event: Event) => {
    if (
      event.type === 'visibilitychange' &&
      document.visibilityState !== 'visible'
    ) {
      return
    }
    if (inFlight) return
    inFlight = true
    void refresh().finally(() => {
      inFlight = false
    })
  }
  document.addEventListener('visibilitychange', onReturn)
  window.addEventListener('focus', onReturn)
  return () => {
    document.removeEventListener('visibilitychange', onReturn)
    window.removeEventListener('focus', onReturn)
  }
}
