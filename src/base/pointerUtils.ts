/**
 * Utilities for pointer event handling
 */

export function isMiddlePointerInput(
  event: PointerEvent | MouseEvent
): boolean {
  if ('button' in event && event.button === 1) {
    return true
  }

  if ('buttons' in event && typeof event.buttons === 'number') {
    return event.buttons === 4
  }

  return false
}

export function isMiddleButtonHeld(event: PointerEvent | MouseEvent): boolean {
  if ('buttons' in event && typeof event.buttons === 'number') {
    return (event.buttons & 4) === 4
  }

  return false
}

export function isMiddleButtonEvent(event: PointerEvent | MouseEvent): boolean {
  return 'button' in event && event.button === 1
}

export function isMiddleForPointerEvent(
  event: PointerEvent | MouseEvent
): boolean {
  if (event.type === 'pointerdown') return isMiddlePointerInput(event)
  if (event.type === 'pointermove' || event.type === 'pointercancel') {
    return isMiddleButtonHeld(event)
  }
  return isMiddleButtonEvent(event)
}
