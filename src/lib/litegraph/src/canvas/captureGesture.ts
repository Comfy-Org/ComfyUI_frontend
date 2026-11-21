export function captureGesture(
  element: Element,
  pointerId: number,
  onInterrupt: () => void
): () => void {
  function onLostPointerCapture(event: Event) {
    if ('pointerId' in event && event.pointerId === pointerId) onInterrupt()
  }

  try {
    element.setPointerCapture(pointerId)
  } catch (error) {
    if (!(error instanceof DOMException)) throw error
  }
  element.addEventListener('lostpointercapture', onLostPointerCapture)
  return () => {
    element.removeEventListener('lostpointercapture', onLostPointerCapture)
    if (element.hasPointerCapture(pointerId))
      element.releasePointerCapture(pointerId)
  }
}
