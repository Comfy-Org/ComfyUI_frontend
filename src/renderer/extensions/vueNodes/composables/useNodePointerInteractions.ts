import { type MaybeRefOrGetter, computed, onUnmounted, ref, toValue } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useNodeLayout } from '@/renderer/extensions/vueNodes/layout/useNodeLayout'

// Treat tiny pointer jitter as a click, not a drag
const DRAG_THRESHOLD_PX = 4

export function useNodePointerInteractions(
  nodeDataMaybe: MaybeRefOrGetter<VueNodeData | null>,
  onPointerUp: (
    event: PointerEvent,
    nodeData: VueNodeData,
    wasDragging: boolean
  ) => void
) {
  const nodeData = computed(() => {
    const value = toValue(nodeDataMaybe)
    if (!value) {
      console.warn(
        'useNodePointerInteractions: nodeDataMaybe resolved to null/undefined'
      )
      return null
    }
    return value
  })

  // Avoid potential null access during component initialization
  const nodeIdComputed = computed(() => nodeData.value?.id ?? '')
  const { startDrag, endDrag, handleDrag } = useNodeLayout(nodeIdComputed)
  // Use canvas interactions for proper wheel event handling and pointer event capture control
  const { forwardEventToCanvas, shouldHandleNodePointerEvents } =
    useCanvasInteractions()

  // Drag state for styling
  const isDragging = ref(false)
  const dragStyle = computed(() => {
    if (nodeData.value?.flags?.pinned) {
      return { cursor: 'default' }
    }
    return { cursor: isDragging.value ? 'grabbing' : 'grab' }
  })
  const startPosition = ref({ x: 0, y: 0 })

  const handlePointerDown = (event: PointerEvent) => {
    if (!nodeData.value) {
      console.warn(
        'LGraphNode: nodeData is null/undefined in handlePointerDown'
      )
      return
    }

    if (event.button === 1) {
      forwardEventToCanvas(event)
      return
    }

    // Only start drag on left-click (button 0)
    if (event.button !== 0) {
      return
    }

    // Don't handle pointer events when canvas is in panning mode - forward to canvas instead
    if (!shouldHandleNodePointerEvents.value) {
      forwardEventToCanvas(event)
      return
    }

    // Don't allow dragging if node is pinned (but still record position for selection)
    startPosition.value = { x: event.clientX, y: event.clientY }
    if (nodeData.value.flags?.pinned) {
      return
    }

    // Start drag using layout system
    isDragging.value = true

    // Set Vue node dragging state for selection toolbox
    layoutStore.isDraggingVueNodes.value = true

    startDrag(event)
  }

  const handlePointerMove = (event: PointerEvent) => {
    if ((event.buttons & 4) !== 0) {
      forwardEventToCanvas(event)
      return
    }

    if (isDragging.value) {
      void handleDrag(event)
    }
  }

  /**
   * Centralized cleanup function for drag state
   * Ensures consistent cleanup across all drag termination scenarios
   */
  const cleanupDragState = () => {
    isDragging.value = false
    layoutStore.isDraggingVueNodes.value = false
  }

  /**
   * Safely ends drag operation with proper error handling
   * @param event - PointerEvent to end the drag with
   */
  const safeDragEnd = async (event: PointerEvent): Promise<void> => {
    try {
      await endDrag(event)
    } catch (error) {
      console.error('Error during endDrag:', error)
    } finally {
      cleanupDragState()
    }
  }

  /**
   * Common drag termination handler with fallback cleanup
   */
  const handleDragTermination = (event: PointerEvent, errorContext: string) => {
    safeDragEnd(event).catch((error) => {
      console.error(`Failed to complete ${errorContext}:`, error)
      cleanupDragState() // Fallback cleanup
    })
  }

  const handlePointerUp = (event: PointerEvent) => {
    if (event.button === 1 || (event.buttons & 4) !== 0) {
      forwardEventToCanvas(event)
      return
    }

    if (isDragging.value) {
      handleDragTermination(event, 'drag end')
    }

    // Don't emit node-click when canvas is in panning mode - forward to canvas instead
    if (!shouldHandleNodePointerEvents.value) {
      forwardEventToCanvas(event)
      return
    }

    // Emit node-click for selection handling in GraphCanvas
    const dx = event.clientX - startPosition.value.x
    const dy = event.clientY - startPosition.value.y
    const wasDragging = Math.hypot(dx, dy) > DRAG_THRESHOLD_PX

    if (!nodeData?.value) return
    onPointerUp(event, nodeData.value, wasDragging)
  }

  /**
   * Handles pointer cancellation events (e.g., touch cancelled by browser)
   * Ensures drag state is properly cleaned up when pointer interaction is interrupted
   */
  const handlePointerCancel = (event: PointerEvent) => {
    if (!isDragging.value) return
    handleDragTermination(event, 'drag cancellation')
  }

  /**
   * Handles right-click during drag operations
   * Cancels the current drag to prevent context menu from appearing while dragging
   */
  const handleContextMenu = (event: MouseEvent) => {
    if (!isDragging.value) return

    event.preventDefault()
    // Simply cleanup state without calling endDrag to avoid synthetic event creation
    cleanupDragState()
  }

  // Cleanup on unmount to prevent resource leaks
  onUnmounted(() => {
    if (!isDragging.value) return
    cleanupDragState()
  })

  const pointerHandlers = {
    onPointerdown: handlePointerDown,
    onPointermove: handlePointerMove,
    onPointerup: handlePointerUp,
    onPointercancel: handlePointerCancel,
    onContextmenu: handleContextMenu
  }

  return {
    isDragging,
    dragStyle,
    pointerHandlers
  }
}
