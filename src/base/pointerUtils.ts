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

/**
 * Checks whether the event's `button` field identifies the middle button —
 * i.e. the event was caused by a middle-button press/release/auxclick. Does
 * not consult the `buttons` bitmask.
 *
 * Use this on state-transition handlers (pointerdown, pointerup, auxclick)
 * where `button` is the authoritative source. pointerup in particular cannot
 * use {@link isMiddleButtonHeld} because the button has just been released
 * and no longer appears in `buttons`.
 */
export function isMiddleButtonEvent(event: PointerEvent | MouseEvent): boolean {
  return 'button' in event && event.button === 1
}

/**
 * Dispatches between the three middle-button predicates based on the event's
 * type, so a single handler bound to multiple pointer events picks the right
 * semantic per event:
 *
 * - pointerdown → {@link isMiddlePointerInput} (strict, rejects chorded
 *   pointerdowns where middle is only incidentally held)
 * - pointermove → {@link isMiddleButtonHeld} (bitmask, keeps a chorded
 *   drag alive when the user adds/removes other buttons mid-gesture)
 * - pointerup and everything else → {@link isMiddleButtonEvent} (`button`
 *   field, the only reliable source on release)
 *
 * Use this at sites that wire the same callback to pointerdown, pointermove,
 * and pointerup together (e.g. capture-phase forwarders). Handlers that only
 * care about a single event type should call the specific helper directly.
 */
export function isMiddleForPointerEvent(
  event: PointerEvent | MouseEvent
): boolean {
  if (event.type === 'pointerdown') return isMiddlePointerInput(event)
  if (event.type === 'pointermove') return isMiddleButtonHeld(event)
  return isMiddleButtonEvent(event)
}
