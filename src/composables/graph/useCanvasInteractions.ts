import { computed } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'

/**
 * Composable for handling canvas interactions from Vue components.
 * This provides a unified way to forward events to the LiteGraph canvas
 * and will be the foundation for migrating canvas interactions to Vue.
 */
export function useCanvasInteractions() {
  const settingStore = useSettingStore()
  const { getCanvas } = useCanvasStore()

  const isStandardNavMode = computed(
    () => settingStore.get('Comfy.Canvas.NavigationMode') === 'standard'
  )

  /**
   * Handles wheel events from UI components that should be forwarded to canvas
   * when appropriate (e.g., Ctrl+wheel for zoom in standard mode)
   */
  const handleWheel = (event: WheelEvent) => {
    // In standard mode, Ctrl+wheel should go to canvas for zoom
    if (isStandardNavMode.value && (event.ctrlKey || event.metaKey)) {
      forwardEventToCanvas(event)
      return
    }

    // In legacy mode, all wheel events go to canvas for zoom
    if (!isStandardNavMode.value) {
      forwardEventToCanvas(event)
      return
    }

    // Otherwise, let the component handle it normally
  }

  /**
   * Handles pointer events from media elements that should potentially
   * be forwarded to canvas (e.g., space+drag for panning)
   */
  const handlePointer = (event: PointerEvent) => {
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
    forwardEventToCanvas
  }
}
