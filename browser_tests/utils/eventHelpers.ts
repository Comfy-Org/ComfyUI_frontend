/**
 * Event helper utilities for browser tests
 */
import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'

interface CreateCanvasEventOptions {
  canvasX: number
  canvasY: number
  button?: number
}

/**
 * Creates a proper CanvasPointerEvent mock for testing by creating a real DOM event
 * This avoids type assertion issues by using the actual browser event APIs
 */
export function createCanvasPointerEvent(
  options: CreateCanvasEventOptions
): CanvasPointerEvent {
  const { canvasX, canvasY, button = 0 } = options

  // Create a real PointerEvent using the constructor
  const event = new PointerEvent('pointerdown', {
    pointerId: 1,
    bubbles: false,
    cancelable: true,
    button,
    buttons: button === 0 ? 1 : button,
    clientX: canvasX,
    clientY: canvasY,
    screenX: canvasX,
    screenY: canvasY,
    isPrimary: true,
    pointerType: 'mouse'
  })

  // Extend with canvas-specific properties
  Object.defineProperties(event, {
    canvasX: { value: canvasX, writable: false },
    canvasY: { value: canvasY, writable: false },
    deltaX: { value: 0, writable: false },
    deltaY: { value: 0, writable: false },
    safeOffsetX: { value: canvasX, writable: false },
    safeOffsetY: { value: canvasY, writable: false }
  })

  return event as CanvasPointerEvent
}
