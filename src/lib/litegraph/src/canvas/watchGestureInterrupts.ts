/**
 * Calls `onInterrupt` when `element` loses pointer capture for `pointerId`.
 * The browser releases capture right after `pointerup` or `pointercancel`, so
 * this reports only gestures that end without either event. Returns a
 * function that stops watching.
 */
export function watchGestureInterrupts(
  element: Element | undefined,
  pointerId: number,
  onInterrupt: () => void
): () => void {
  function onLostPointerCapture(event: Event) {
    if ('pointerId' in event && event.pointerId === pointerId) onInterrupt()
  }

  element?.addEventListener('lostpointercapture', onLostPointerCapture)
  return () =>
    element?.removeEventListener('lostpointercapture', onLostPointerCapture)
}
