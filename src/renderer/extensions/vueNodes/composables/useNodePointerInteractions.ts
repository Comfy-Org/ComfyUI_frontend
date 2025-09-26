import {
  type MaybeRefOrGetter,
  computed,
  onUnmounted,
  reactive,
  readonly,
  toValue
} from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useNodeLayout } from '@/renderer/extensions/vueNodes/layout/useNodeLayout'

// Position type for better type safety and consistency
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
  const { startDrag, endDrag, handleDrag } = useNodeLayout(nodeIdComputed)
  // Use canvas interactions for proper wheel event handling and pointer event capture control
  const { forwardEventToCanvas, shouldHandleNodePointerEvents } =
    useCanvasInteractions()

  // Vue-native reactive coordination object (single source of truth)
  const dragCoordination = reactive({
    hasPointerDown: false,
    startPosition: { x: 0, y: 0 } as Position,
    layoutEngaged: false
  })

  // Derived states for different consumers (Vue-native "state machine")
  const isActivelyDragging = computed(
    () => dragCoordination.hasPointerDown && dragCoordination.layoutEngaged
  )
  const shouldHideSelectionUI = computed(() => isActivelyDragging.value)
  const dragStyle = computed(() => ({
    cursor: isActivelyDragging.value ? 'grabbing' : 'grab'
  }))

  // Single coordination function replaces three separate state updates
  const coordinateStateChange = (changes: Partial<typeof dragCoordination>) => {
    Object.assign(dragCoordination, changes)

    // Sync to layout store for UI consumers (computed reactivity handles timing)
    layoutStore.isDraggingVueNodes.value = shouldHideSelectionUI.value
  }

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

    // Coordinate state change across all systems
    coordinateStateChange({
      hasPointerDown: true,
      startPosition: { x: event.clientX, y: event.clientY },
      layoutEngaged: false // Will be set to true when startDrag succeeds
    })

    startDrag(event)

    // Mark layout as engaged after successful start
    coordinateStateChange({ layoutEngaged: true })
  }

  const handlePointerMove = (event: PointerEvent) => {
    if (!isActivelyDragging.value) return

    handleDrag(event)
  }

  /**
   * Centralized cleanup function for drag state
   * Ensures consistent cleanup across all drag termination scenarios
   */
  const cleanupDragState = () => {
    coordinateStateChange({
      hasPointerDown: false,
      layoutEngaged: false
    })
  }

  /**
   * Safely ends drag operation with proper error handling
   * @param event - PointerEvent to end the drag with
   */
  const safeDragEnd = async (event: PointerEvent): Promise<void> => {
    try {
      await endDrag(event)
    } catch (error) {
      console.error('useNodePointerInteractions: Error during endDrag -', error)
    } finally {
      cleanupDragState()
    }
  }

  /**
   * Common drag termination handler with fallback cleanup
   */
  const handleDragTermination = (event: PointerEvent, errorContext: string) => {
    safeDragEnd(event).catch((error) => {
      console.error(
        `useNodePointerInteractions: Failed to complete ${errorContext} -`,
        error
      )
      cleanupDragState() // Fallback cleanup
    })
  }

  const handlePointerUp = (event: PointerEvent) => {
    if (isActivelyDragging.value) {
      handleDragTermination(event, 'drag end')
    }

    if (!shouldHandleNodePointerEvents.value) {
      forwardEventToCanvas(event)
      return
    }

    if (!nodeData?.value) return

    // Emit node-click for selection handling in GraphCanvas
    const dx = event.clientX - dragCoordination.startPosition.x
    const dy = event.clientY - dragCoordination.startPosition.y
    const wasDragging = dx * dx + dy * dy > DRAG_THRESHOLD_SQUARED

    onPointerUp(event, nodeData.value, wasDragging)
  }

  /**
   * Handles pointer cancellation events (e.g., touch cancelled by browser)
   * Ensures drag state is properly cleaned up when pointer interaction is interrupted
   */
  const handlePointerCancel = (event: PointerEvent) => {
    if (!isActivelyDragging.value) return

    handleDragTermination(event, 'drag cancellation')
  }

  /**
   * Handles right-click during drag operations
   * Cancels the current drag to prevent context menu from appearing while dragging
   */
  const handleContextMenu = (event: MouseEvent) => {
    if (!isActivelyDragging.value) return

    event.preventDefault()
    // Simply cleanup state without calling endDrag to avoid synthetic event creation
    cleanupDragState()
  }

  // Cleanup on unmount to prevent resource leaks
  onUnmounted(() => {
    if (!isActivelyDragging.value) return

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
    isDragging: isActivelyDragging, // For backwards compatibility
    dragStyle,
    pointerHandlers,
    // New Vue-native reactive coordination
    dragCoordination: readonly(dragCoordination),
    isActivelyDragging,
    shouldHideSelectionUI
  }
}
