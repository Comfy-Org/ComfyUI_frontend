/**
 * Calls `onInterrupt` once the browser can no longer deliver the rest of a
 * pointer gesture: the element loses pointer capture, the window loses focus,
 * or the document is hidden. Returns a function that stops watching.
 */
export function watchGestureInterrupts(
  element: Element | undefined,
  onInterrupt: () => void
): () => void {
  const doc = element?.ownerDocument ?? document
  const view = doc.defaultView
  function onVisibilityChange() {
    if (doc.visibilityState === 'hidden') onInterrupt()
  }

  element?.addEventListener('lostpointercapture', onInterrupt)
  view?.addEventListener('blur', onInterrupt)
  doc.addEventListener('visibilitychange', onVisibilityChange)

  return () => {
    element?.removeEventListener('lostpointercapture', onInterrupt)
    view?.removeEventListener('blur', onInterrupt)
    doc.removeEventListener('visibilitychange', onVisibilityChange)
  }
}
