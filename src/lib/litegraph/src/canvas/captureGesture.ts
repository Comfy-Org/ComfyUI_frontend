function isDomException(error: unknown): boolean {
  if (error instanceof DOMException) return true
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error.name === 'NotFoundError' || error.name === 'InvalidStateError')
  )
}

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
    if (!isDomException(error)) throw error
  }
  element.addEventListener('lostpointercapture', onLostPointerCapture)
  return () => {
    element.removeEventListener('lostpointercapture', onLostPointerCapture)
    if (element.hasPointerCapture(pointerId))
      element.releasePointerCapture(pointerId)
  }
}
