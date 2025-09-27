import { type MaybeRefOrGetter, computed, ref, toValue, watch } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useNodeLayout } from '@/renderer/extensions/vueNodes/layout/useNodeLayout'

interface Position {
  x: number
  y: number
}

// Treat tiny pointer jitter as a click, not a drag
const DRAG_THRESHOLD_PX = 4
const DRAG_THRESHOLD_SQUARED = DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX

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
  const { startDrag, endDrag, handleDrag, isDragging } =
    useNodeLayout(nodeIdComputed)
  // Use canvas interactions for proper wheel event handling and pointer event capture control
  const { forwardEventToCanvas, shouldHandleNodePointerEvents } =
    useCanvasInteractions()

  const startPosition = ref<Position>({ x: 0, y: 0 })

  const stopWatcher = watch(
    isDragging,
    (dragging) => {
      layoutStore.isDraggingVueNodes.value = dragging
    },
    { immediate: true }
  )

  const handlePointerDown = (event: PointerEvent) => {
    if (!nodeData.value) {
      console.warn(
        'useNodePointerInteractions: nodeData is null in handlePointerDown'
      )
      return
    }

    if (event.button !== 0) return

    if (!shouldHandleNodePointerEvents.value) {
      forwardEventToCanvas(event)
      return
    }

    startPosition.value = { x: event.clientX, y: event.clientY }

    const dragStarted = startDrag(event)
    if (!dragStarted) {
      startPosition.value = { x: 0, y: 0 }
      return
    }
  }

  const handlePointerMove = (event: PointerEvent) => {
    if (!isDragging.value) return

    handleDrag(event)
  }

  /**
   * Safely ends drag operation with proper error handling
   * @param event - PointerEvent to end the drag with
   */
  const safeDragEnd = async (event: PointerEvent): Promise<void> => {
    try {
      await endDrag(event)
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      console.error(
        'useNodePointerInteractions: Error during endDrag -',
        errorMessage
      )
    }
  }

  /**
   * Common drag termination handler with fallback cleanup
   */
  const handleDragTermination = (event: PointerEvent, errorContext: string) => {
    safeDragEnd(event).catch((error: unknown) => {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      console.error(
        `useNodePointerInteractions: Failed to complete ${errorContext} -`,
        errorMessage
      )
    })
  }

  const handlePointerUp = (event: PointerEvent) => {
    if (isDragging.value) {
      handleDragTermination(event, 'drag end')
    }

    if (!shouldHandleNodePointerEvents.value) {
      forwardEventToCanvas(event)
      return
    }

    if (!nodeData?.value) return

    // Emit node-click for selection handling in GraphCanvas
    const dx = event.clientX - startPosition.value.x
    const dy = event.clientY - startPosition.value.y
    const wasDragging = dx * dx + dy * dy > DRAG_THRESHOLD_SQUARED

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
  }

  const pointerHandlers = {
    onPointerdown: handlePointerDown,
    onPointermove: handlePointerMove,
    onPointerup: handlePointerUp,
    onPointercancel: handlePointerCancel,
    onContextmenu: handleContextMenu
  }

  return {
    isDragging,
    pointerHandlers,
    stopWatcher
  }
}
