/**
 * A cancellation, card change, or payment made in a hosted tab never pushes
 * back to this one, so the next `focus`/`visibilitychange` re-reads whatever
 * that tab could have changed. Shared by every opener of a hosted billing
 * tab or window so they arm the same return signal one way.
 */
export function registerRefreshOnReturn(
  refresh: () => Promise<unknown>
): () => void {
  const stopListening = () => {
    document.removeEventListener('visibilitychange', onReturn)
    window.removeEventListener('focus', onReturn)
  }
  const onReturn = (event: Event) => {
    if (
      event.type === 'visibilitychange' &&
      document.visibilityState !== 'visible'
    ) {
      return
    }
    stopListening()
    void refresh()
  }
  document.addEventListener('visibilitychange', onReturn)
  window.addEventListener('focus', onReturn)
  return stopListening
}
