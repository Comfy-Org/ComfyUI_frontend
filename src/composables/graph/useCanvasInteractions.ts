import { computed } from 'vue'

import { app } from '@/scripts/app'
import { useCanvasStore } from '@/stores/graphStore'
import { useSettingStore } from '@/stores/settingStore'

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
      event.preventDefault() // Prevent browser zoom
      forwardEventToCanvas(event)
      return
    }

    // In legacy mode, all wheel events go to canvas for zoom
    if (!isStandardNavMode.value) {
      event.preventDefault()
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

    // Forward space+drag (panning) events to canvas
    // The canvas already handles space key state via read_only property
    if (canvas.read_only && event.buttons === 1) {
      event.preventDefault()
      event.stopPropagation()
      forwardEventToCanvas(event)
      return
    }

    // Forward middle mouse button events for panning
    if (event.buttons === 4) {
      event.preventDefault()
      event.stopPropagation()
      forwardEventToCanvas(event)
      return
    }

    // Otherwise, let the media element handle normally (preserves drag behavior)
  }

  /**
   * Forwards an event to the LiteGraph canvas
   */
  const forwardEventToCanvas = (
    event: WheelEvent | PointerEvent | MouseEvent
  ) => {
    const canvasEl = app.canvas?.canvas
    if (!canvasEl) return

    // Create new event with same properties
    const EventConstructor = event.constructor as typeof WheelEvent
    const newEvent = new EventConstructor(event.type, event)
    canvasEl.dispatchEvent(newEvent)
  }

  return {
    handleWheel,
    handlePointer,
    forwardEventToCanvas
  }
}
