import { computed, onUnmounted, ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { isMiddlePointerInput } from '@/base/pointerUtils'
import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useVueNodeLifecycle } from '@/composables/graph/useVueNodeLifecycle'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useNodeEventHandlers } from '@/renderer/extensions/vueNodes/composables/useNodeEventHandlers'
import { isMultiSelectKey } from '@/renderer/extensions/vueNodes/utils/selectionUtils'
import { useNodeDrag } from '@/renderer/extensions/vueNodes/layout/useNodeDrag'

export function useNodePointerInteractions(
  nodeDataMaybe: MaybeRefOrGetter<VueNodeData | null>
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

  const { startDrag, endDrag, handleDrag } = useNodeDrag(
    () => nodeData.value?.id ?? ''
  )
  // Use canvas interactions for proper wheel event handling and pointer event capture control
  const { forwardEventToCanvas, shouldHandleNodePointerEvents } =
    useCanvasInteractions()
  const {
    handleNodeSelect,
    toggleNodeSelectionAfterPointerUp,
    ensureNodeSelectedForShiftDrag
  } = useNodeEventHandlers()
  const { nodeManager } = useVueNodeLifecycle()

  const forwardMiddlePointerIfNeeded = (event: PointerEvent) => {
    if (!isMiddlePointerInput(event)) return false
    forwardEventToCanvas(event)
    return true
  }

  // Drag state for styling
  const isPointerDown = ref(false)
  const wasSelectedAtPointerDown = ref(false) // Track if node was selected when pointer down occurred
  const startPosition = ref({ x: 0, y: 0 })

  const DRAG_THRESHOLD = 3 // pixels

  function onPointerdown(event: PointerEvent) {
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

    handleNodeSelect(event, nodeData.value)

    if (nodeData.value.flags?.pinned) {
      return
    }

    // Record position for drag threshold calculation
    startPosition.value = { x: event.clientX, y: event.clientY }
    isPointerDown.value = true

    // Don't start drag yet - wait for pointer move to exceed threshold
    startDrag(event)
  }

  function onPointermove(event: PointerEvent) {
    if (forwardMiddlePointerIfNeeded(event)) return

    // Check if we should start dragging (pointer moved beyond threshold)
    if (isPointerDown.value && !layoutStore.isDraggingVueNodes.value) {
      const dx = event.clientX - startPosition.value.x
      const dy = event.clientY - startPosition.value.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance > DRAG_THRESHOLD && nodeData.value) {
        // Start drag
        layoutStore.isDraggingVueNodes.value = true
        ensureNodeSelectedForShiftDrag(
          event,
          nodeData.value,
          wasSelectedAtPointerDown.value
        )
      }
    }

    if (layoutStore.isDraggingVueNodes.value) {
      void handleDrag(event)
    }
  }

  /**
   * Centralized cleanup function for drag state
   * Ensures consistent cleanup across all drag termination scenarios
   */
  function cleanupDragState() {
    isPointerDown.value = false
    wasSelectedAtPointerDown.value = false
    layoutStore.isDraggingVueNodes.value = false
  }

  /**
   * Safely ends drag operation with proper error handling
   * @param event - PointerEvent to end the drag with
   */
  function safeDragEnd(event: PointerEvent) {
    try {
      endDrag(event)
    } catch (error) {
      console.error('Error during endDrag:', error)
    } finally {
      cleanupDragState()
    }
  }

  function onPointerup(event: PointerEvent) {
    if (forwardMiddlePointerIfNeeded(event)) return

    const wasDragging = layoutStore.isDraggingVueNodes.value
    const multiSelect = isMultiSelectKey(event)
    const canHandlePointer = shouldHandleNodePointerEvents.value

    if (wasDragging) {
      safeDragEnd(event)
    } else {
      // Clean up pointer state even if not dragging
      isPointerDown.value = false
      const wasSelected = wasSelectedAtPointerDown.value
      wasSelectedAtPointerDown.value = false

      if (nodeData.value && canHandlePointer) {
        toggleNodeSelectionAfterPointerUp(nodeData.value.id, {
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
