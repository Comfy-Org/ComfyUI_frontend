import { computed, onUnmounted, ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { isMiddlePointerInput } from '@/base/pointerUtils'
import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useVueNodeLifecycle } from '@/composables/graph/useVueNodeLifecycle'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useNodeLayout } from '@/renderer/extensions/vueNodes/layout/useNodeLayout'
import { useNodeEventHandlers } from '@/renderer/extensions/vueNodes/composables/useNodeEventHandlers'

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
  const { toggleNodeSelectionAfterPointerUp } = useNodeEventHandlers()
  const { nodeManager } = useVueNodeLifecycle()

  const forwardMiddlePointerIfNeeded = (event: PointerEvent) => {
    if (!isMiddlePointerInput(event)) return false
    forwardEventToCanvas(event)
    return true
  }

  // Drag state for styling
  const isDragging = ref(false)
  const isPointerDown = ref(false)
  const wasSelectedAtPointerDown = ref(false) // Track if node was selected when pointer down occurred
  const dragStyle = computed(() => {
    if (nodeData.value?.flags?.pinned) {
      return { cursor: 'default' }
    }
    return { cursor: isDragging.value ? 'grabbing' : 'grab' }
  })
  const startPosition = ref({ x: 0, y: 0 })
  const DRAG_THRESHOLD = 3 // pixels

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

    // Track if node was selected before this pointer down
    // IMPORTANT: Read from actual LGraphNode, not nodeData, to get correct state
    const lgNode = nodeManager.value?.getNode(nodeData.value.id)
    wasSelectedAtPointerDown.value = lgNode?.selected ?? false

    onNodeSelect(event, nodeData.value)

    if (nodeData.value.flags?.pinned) {
      return
    }

    // Record position for drag threshold calculation
    startPosition.value = { x: event.clientX, y: event.clientY }
    isPointerDown.value = true

    // Don't start drag yet - wait for pointer move to exceed threshold
    startDrag(event)
  }

  const handlePointerMove = (event: PointerEvent) => {
    if (forwardMiddlePointerIfNeeded(event)) return

    // Check if we should start dragging (pointer moved beyond threshold)
    if (isPointerDown.value && !isDragging.value) {
      const dx = event.clientX - startPosition.value.x
      const dy = event.clientY - startPosition.value.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance > DRAG_THRESHOLD) {
        // Start drag
        isDragging.value = true
        layoutStore.isDraggingVueNodes.value = true
      }
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
    isPointerDown.value = false
    wasSelectedAtPointerDown.value = false
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

    const wasDragging = isDragging.value
    const isMultiSelect = event.ctrlKey || event.metaKey || event.shiftKey
    const canHandlePointer = shouldHandleNodePointerEvents.value

    if (wasDragging) {
      handleDragTermination(event, 'drag end')
    } else {
      // Clean up pointer state even if not dragging
      isPointerDown.value = false
      const wasSelected = wasSelectedAtPointerDown.value
      wasSelectedAtPointerDown.value = false

      if (nodeData.value && canHandlePointer) {
        toggleNodeSelectionAfterPointerUp(nodeData.value.id, {
          wasSelectedAtPointerDown: wasSelected,
          multiSelect: isMultiSelect
        })
      }
    }

    // Don't handle pointer events when canvas is in panning mode - forward to canvas instead
    if (!canHandlePointer) {
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
