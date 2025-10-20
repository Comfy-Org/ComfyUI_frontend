import { computed, onUnmounted, ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { isMiddlePointerInput } from '@/base/pointerUtils'
import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useNodeLayout } from '@/renderer/extensions/vueNodes/layout/useNodeLayout'

export function useNodePointerInteractions(
  nodeDataMaybe: MaybeRefOrGetter<VueNodeData | null>,
  onNodeSelect: (event: PointerEvent, nodeData: VueNodeData) => void
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

  const forwardMiddlePointerIfNeeded = (event: PointerEvent) => {
    if (!isMiddlePointerInput(event)) return false
    forwardEventToCanvas(event)
    return true
  }

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

    if (forwardMiddlePointerIfNeeded(event)) return

    // Only start drag on left-click (button 0)
    if (event.button !== 0) {
      return
    }

    // Don't handle pointer events when canvas is in panning mode - forward to canvas instead
    if (!shouldHandleNodePointerEvents.value) {
      forwardEventToCanvas(event)
      return
    }

    // Record position for drag threshold calculation
    startPosition.value = { x: event.clientX, y: event.clientY }

    onNodeSelect(event, nodeData.value)

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
    if (forwardMiddlePointerIfNeeded(event)) return

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
    if (forwardMiddlePointerIfNeeded(event)) return

    if (isDragging.value) {
      handleDragTermination(event, 'drag end')
    }

    // Don't handle pointer events when canvas is in panning mode - forward to canvas instead
    if (!shouldHandleNodePointerEvents.value) {
      forwardEventToCanvas(event)
      return
    }
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
