/**
 * Calls `onInterrupt` when the application treats a pointer gesture as
 * interrupted: the element loses pointer capture, the window loses focus, or
 * the document is hidden. Returns a function that stops watching.
 */
export function watchGestureInterrupts(
  element: Element | undefined,
  pointerId: number,
  onInterrupt: () => void
): () => void {
  const doc = element?.ownerDocument ?? document
  const view = doc.defaultView
  function onLostPointerCapture(event: Event) {
    if ('pointerId' in event && event.pointerId === pointerId) {
      onInterrupt()
    }
  }
  function onVisibilityChange() {
    if (doc.visibilityState === 'hidden') onInterrupt()
  }

  element?.addEventListener('lostpointercapture', onLostPointerCapture)
  view?.addEventListener('blur', onInterrupt)
  doc.addEventListener('visibilitychange', onVisibilityChange)

  return () => {
    element?.removeEventListener('lostpointercapture', onLostPointerCapture)
    view?.removeEventListener('blur', onInterrupt)
    doc.removeEventListener('visibilitychange', onVisibilityChange)
  }
}
