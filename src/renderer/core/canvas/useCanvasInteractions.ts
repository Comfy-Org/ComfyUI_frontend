import { computed } from 'vue'

import { isMiddlePointerInput } from '@/base/pointerUtils'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'

/**
 * Wheel events whose browser default would break the editing experience.
 * On macOS trackpads:
 *   - `ctrl/meta + wheel` (pinch-zoom) triggers page-level zoom, which
 *     pushes fixed-position UI (e.g. ComfyActionbar) off-screen with no
 *     recovery short of a page reload.
 *   - Horizontal-dominant wheel (two-finger horizontal swipe) triggers
 *     back/forward navigation, which leaves the workflow.
 * Components that intercept wheel events should suppress the default for
 * these gestures even when they otherwise let the browser scroll natively.
 */
export const isCanvasGestureWheel = (event: WheelEvent): boolean =>
  event.ctrlKey ||
  event.metaKey ||
  Math.abs(event.deltaX) > Math.abs(event.deltaY)

/**
 * Composable for handling canvas interactions from Vue components.
 * This provides a unified way to forward events to the LiteGraph canvas.
 */
export function useCanvasInteractions() {
  const settingStore = useSettingStore()
  const canvasStore = useCanvasStore()
  const { getCanvas } = canvasStore

  const isStandardNavMode = computed(
    () => settingStore.get('Comfy.Canvas.NavigationMode') === 'standard'
  )

  /**
   * Whether Vue node components should handle pointer events.
   * Returns false when canvas is in read-only/panning mode (e.g., space key held for panning).
   */
  const shouldHandleNodePointerEvents = computed(
    () => !(canvasStore.canvas?.read_only ?? false)
  )

  /**
   * Returns true if the wheel event target is inside an element that should
   * capture wheel events AND that element (or a descendant) currently has focus.
   *
   * This allows two-finger panning to continue over inputs until the user has
   * actively focused the widget, at which point the widget can consume scroll.
   */
  const wheelCapturedByFocusedElement = (event: WheelEvent): boolean => {
    const target = event.target as HTMLElement | null
    const captureElement = target?.closest('[data-capture-wheel="true"]')
    const active = document.activeElement as Element | null

    return !!(captureElement && active && captureElement.contains(active))
  }

  /**
   * Forward to canvas when the event is not consumed by a focused widget,
   * or when it is a canvas gesture (which must override widget consumption
   * to prevent destructive browser defaults).
   */
  const shouldForwardWheelEvent = (event: WheelEvent): boolean =>
    !wheelCapturedByFocusedElement(event) || isCanvasGestureWheel(event)

  /**
   * Handles wheel events from UI components that should be forwarded to canvas
   * when appropriate (e.g., Ctrl+wheel for zoom, two-finger pan in standard
   * mode; all wheel events in legacy mode).
   */
  const handleWheel = (event: WheelEvent) => {
    if (!shouldForwardWheelEvent(event)) return

    // In standard mode, only canvas gestures (zoom/pan) are forwarded;
    // vertical wheel falls through so the document/widget scrolls normally.
    if (isStandardNavMode.value) {
      if (isCanvasGestureWheel(event)) forwardEventToCanvas(event)
      return
    }

    // In legacy mode, all forwardable wheel events go to canvas for zoom/pan.
    forwardEventToCanvas(event)
  }

  /**
   * Handles pointer events from media elements that should potentially
   * be forwarded to canvas (e.g., space+drag for panning)
   */
  const handlePointer = (event: PointerEvent) => {
    if (isMiddlePointerInput(event)) {
      forwardEventToCanvas(event)
      return
    }

    // Check if canvas exists using established pattern
    const canvas = getCanvas()
    if (!canvas) return

    // Check conditions for forwarding events to canvas
    const isSpacePanningDrag = canvas.read_only && event.buttons === 1 // Space key pressed + left mouse drag
    const isMiddleMousePanning = event.buttons === 4 // Middle mouse button for panning

    if (isSpacePanningDrag || isMiddleMousePanning) {
      event.preventDefault()
      event.stopPropagation()
      forwardEventToCanvas(event)
      return
    }
  }

  /**
   * Forwards an event to the LiteGraph canvas
   */
  const forwardEventToCanvas = (
    event: WheelEvent | PointerEvent | MouseEvent
  ) => {
    // Honor wheel capture only when the element is focused
    if (event instanceof WheelEvent && !shouldForwardWheelEvent(event)) return

    const canvasEl = app.canvas?.canvas
    if (!canvasEl) return
    event.preventDefault()
    event.stopPropagation()

    if (event instanceof WheelEvent) {
      const { clientX, clientY, deltaX, deltaY, ctrlKey, metaKey, shiftKey } =
        event
      canvasEl.dispatchEvent(
        new WheelEvent('wheel', {
          clientX,
          clientY,
          deltaX,
          deltaY,
          ctrlKey,
          metaKey,
          shiftKey
        })
      )
      return
    }

    // Create new event with same properties
    const EventConstructor = event.constructor as
      | typeof MouseEvent
      | typeof PointerEvent
    const newEvent = new EventConstructor(event.type, event)
    canvasEl.dispatchEvent(newEvent)
  }

  return {
    handleWheel,
    handlePointer,
    forwardEventToCanvas,
    shouldHandleNodePointerEvents
  }
}
