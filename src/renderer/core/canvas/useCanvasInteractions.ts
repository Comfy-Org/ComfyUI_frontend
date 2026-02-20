import { computed } from 'vue'

import {
  isMiddleButtonEvent,
  isMiddleButtonHeld,
  isMiddlePointerInput
} from '@/base/pointerUtils'
import { isCanvasGestureWheel } from '@/base/wheelGestures'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'

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
  const shouldHandleNodePointerEvents = computed(() => !canvasStore.isReadOnly)

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
    // The re-check is intentional and NOT redundant with shouldForwardWheelEvent:
    // that function also returns true for unfocused vertical wheel (its
    // `!wheelCapturedByFocusedElement` branch), which here must stay native.
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
  const forwardMiddlePointerIfNeeded = (
    event: PointerEvent,
    isMiddleInput: (event: PointerEvent) => boolean
  ) => {
    if (isMiddleInput(event)) {
      forwardEventToCanvas(event)
      return true
    }

    return false
  }

  const handleLeftButtonReadOnlyPointer = (event: PointerEvent) => {
    // Check if canvas exists using established pattern
    const canvas = getCanvas()
    if (!canvas) return

    if (canvas.read_only && event.buttons === 1) {
      event.preventDefault()
      event.stopPropagation()
      forwardEventToCanvas(event)
    }
  }

  const handlePointerDown = (event: PointerEvent) => {
    if (forwardMiddlePointerIfNeeded(event, isMiddlePointerInput)) return
    handleLeftButtonReadOnlyPointer(event)
  }

  const handlePointerMove = (event: PointerEvent) => {
    if (forwardMiddlePointerIfNeeded(event, isMiddleButtonHeld)) return
    handleLeftButtonReadOnlyPointer(event)
  }

  const handlePointerUp = (event: PointerEvent) => {
    if (forwardMiddlePointerIfNeeded(event, isMiddleButtonEvent)) return
    handleLeftButtonReadOnlyPointer(event)
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
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    forwardEventToCanvas,
    shouldHandleNodePointerEvents
  }
}
