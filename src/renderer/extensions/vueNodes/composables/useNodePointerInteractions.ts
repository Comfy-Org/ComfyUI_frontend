import { onUnmounted, ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { isMiddlePointerInput } from '@/base/pointerUtils'
import { useVueNodeLifecycle } from '@/composables/graph/useVueNodeLifecycle'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useNodeEventHandlers } from '@/renderer/extensions/vueNodes/composables/useNodeEventHandlers'
import { isMultiSelectKey } from '@/renderer/extensions/vueNodes/utils/selectionUtils'
import { useNodeDrag } from '@/renderer/extensions/vueNodes/layout/useNodeDrag'

export function useNodePointerInteractions(
  nodeIdRef: MaybeRefOrGetter<string>
) {
  const { startDrag, endDrag, handleDrag } = useNodeDrag()
  // Use canvas interactions for proper wheel event handling and pointer event capture control
  const { forwardEventToCanvas, shouldHandleNodePointerEvents } =
    useCanvasInteractions()
  const { handleNodeSelect, toggleNodeSelectionAfterPointerUp } =
    useNodeEventHandlers()
  const { nodeManager } = useVueNodeLifecycle()

  const forwardMiddlePointerIfNeeded = (event: PointerEvent) => {
    if (!isMiddlePointerInput(event)) return false
    forwardEventToCanvas(event)
    return true
  }

  // Drag state for styling
  const wasSelectedAtPointerDown = ref(false) // Track if node was selected when pointer down occurred
  const startPosition = ref({ x: 0, y: 0 })

  const DRAG_THRESHOLD = 3 // pixels

  function onPointerdown(event: PointerEvent) {
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

    const nodeId = toValue(nodeIdRef)
    if (!nodeId) {
      console.warn(
        'LGraphNode: nodeData is null/undefined in handlePointerDown'
      )
      return
    }

    // Track if node was selected before this pointer down
    // IMPORTANT: Read from actual LGraphNode, not nodeData, to get correct state
    const lgNode = nodeManager.value?.getNode(nodeId)
    wasSelectedAtPointerDown.value = lgNode?.selected ?? false

    handleNodeSelect(event, nodeId)

    if (lgNode?.flags?.pinned) {
      return
    }

    // Record position for drag threshold calculation
    startPosition.value = { x: event.clientX, y: event.clientY }

    // Don't start drag yet - wait for pointer move to exceed threshold
    startDrag(event, nodeId)
  }

  function onPointermove(event: PointerEvent) {
    if (forwardMiddlePointerIfNeeded(event)) return
    const nodeId = toValue(nodeIdRef)

    const lmbDown = event.buttons & 1
    // Check if we should start dragging (pointer moved beyond threshold)
    if (lmbDown && !layoutStore.isDraggingVueNodes.value) {
      const dx = event.clientX - startPosition.value.x
      const dy = event.clientY - startPosition.value.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance > DRAG_THRESHOLD) {
        layoutStore.isDraggingVueNodes.value = true
      }
    }

    if (layoutStore.isDraggingVueNodes.value) {
      void handleDrag(event, nodeId ?? '')
    }
  }

  /**
   * Centralized cleanup function for drag state
   * Ensures consistent cleanup across all drag termination scenarios
   */
  function cleanupDragState() {
    wasSelectedAtPointerDown.value = false
    layoutStore.isDraggingVueNodes.value = false
  }

  /**
   * Safely ends drag operation with proper error handling
   * @param event - PointerEvent to end the drag with
   */
  function safeDragEnd(event: PointerEvent) {
    try {
      const nodeId = toValue(nodeIdRef)
      endDrag(event, nodeId)
    } catch (error) {
      console.error('Error during endDrag:', error)
    } finally {
      cleanupDragState()
    }
  }

  function onPointerup(event: PointerEvent) {
    if (forwardMiddlePointerIfNeeded(event)) return

    const wasDragging = layoutStore.isDraggingVueNodes.value
    const canHandlePointer = shouldHandleNodePointerEvents.value

    if (wasDragging) {
      safeDragEnd(event)
    } else {
      const wasSelected = wasSelectedAtPointerDown.value
      const multiSelect = isMultiSelectKey(event)

      // Clean up pointer state even if not dragging
      wasSelectedAtPointerDown.value = false

      const nodeId = toValue(nodeIdRef)
      if (nodeId && canHandlePointer) {
        toggleNodeSelectionAfterPointerUp(nodeId, {
          wasSelectedAtPointerDown: wasSelected,
          multiSelect
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
  function onPointercancel(event: PointerEvent) {
    if (!layoutStore.isDraggingVueNodes.value) return
    safeDragEnd(event)
  }

  /**
   * Handles right-click during drag operations
   * Cancels the current drag to prevent context menu from appearing while dragging
   */
  function onContextmenu(event: MouseEvent) {
    if (!layoutStore.isDraggingVueNodes.value) return

    event.preventDefault()
    // Simply cleanup state without calling endDrag to avoid synthetic event creation
    cleanupDragState()
  }

  // Cleanup on unmount to prevent resource leaks
  onUnmounted(() => {
    cleanupDragState()
  })

  const pointerHandlers = {
    onPointerdown,
    onPointermove,
    onPointerup,
    onPointercancel,
    onContextmenu
  } as const

  return {
    pointerHandlers
  }
}
