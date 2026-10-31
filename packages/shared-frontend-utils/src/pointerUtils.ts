/**
 * Utilities for pointer event handling
 */

export function isMiddlePointerInput(event: MouseEvent): boolean {
  return event.button === 1 || event.buttons === 4
}

export function isMiddleButtonHeld(event: MouseEvent): boolean {
  return (event.buttons & 4) === 4
}

export function isMiddleButtonEvent(event: MouseEvent): boolean {
  return event.button === 1
}
