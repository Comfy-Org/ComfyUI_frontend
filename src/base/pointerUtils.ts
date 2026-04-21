/**
 * Utilities for pointer event handling
 */

/**
 * Checks if a pointer or mouse event is a middle button input.
 *
 * Uses strict `buttons === 4` on the move branch so that chorded pointerdown
 * events (e.g., left-click while middle is incidentally held) are not
 * misclassified as middle-button clicks. For "is the middle button currently
 * held regardless of other buttons" semantics (typical for pointermove panning
 * or held-state indicators), use {@link isMiddleButtonHeld} instead.
 *
 * @param event - The pointer or mouse event to check
 * @returns true if the event is from the middle button/wheel
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

/**
 * Checks if the middle button is currently held, using a bitmask so chorded
 * states (middle + left, middle + right, etc.) still register as held.
 *
 * Use this on pointermove-style handlers that want to keep a middle-button
 * gesture alive while other buttons transition. Do NOT use on pointerdown
 * where a freshly-pressed left button while middle is held would otherwise be
 * misclassified as middle input — use {@link isMiddlePointerInput} there.
 */
export function isMiddleButtonHeld(event: PointerEvent | MouseEvent): boolean {
  if ('buttons' in event && typeof event.buttons === 'number') {
    return (event.buttons & 4) === 4
  }

  return false
}
