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
