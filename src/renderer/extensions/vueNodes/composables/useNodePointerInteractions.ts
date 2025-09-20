import { type MaybeRefOrGetter, computed, ref, toValue } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useNodeLayout } from '@/renderer/extensions/vueNodes/layout/useNodeLayout'

// Treat tiny pointer jitter as a click, not a drag
const DRAG_THRESHOLD_PX = 4

export function useNodePointerInteractions(
  nodeDataMaybe: MaybeRefOrGetter<VueNodeData>,
  onPointerUp: (
    event: PointerEvent,
    nodeData: VueNodeData,
    wasDragging: boolean
  ) => void
) {
  const nodeData = toValue(nodeDataMaybe)

  const { startDrag, endDrag, handleDrag } = useNodeLayout(nodeData.id)
  // Use canvas interactions for proper wheel event handling and pointer event capture control
  const { forwardEventToCanvas, shouldHandleNodePointerEvents } =
    useCanvasInteractions()

  // Drag state for styling
  const isDragging = ref(false)
  const dragStyle = computed(() => ({
    cursor: isDragging.value ? 'grabbing' : 'grab'
  }))
  const lastX = ref(0)
  const lastY = ref(0)

  const handlePointerDown = (event: PointerEvent) => {
    if (!nodeData) {
      console.warn(
        'LGraphNode: nodeData is null/undefined in handlePointerDown'
      )
      return
    }

    // Don't handle pointer events when canvas is in panning mode - forward to canvas instead
    if (!shouldHandleNodePointerEvents.value) {
      forwardEventToCanvas(event)
      return
    }

    // Start drag using layout system
    isDragging.value = true

    // Set Vue node dragging state for selection toolbox
    layoutStore.isDraggingVueNodes.value = true

    startDrag(event)
    lastY.value = event.clientY
    lastX.value = event.clientX
  }

  const handlePointerMove = (event: PointerEvent) => {
    if (isDragging.value) {
      void handleDrag(event)
    }
  }

  const handlePointerUp = (event: PointerEvent) => {
    if (isDragging.value) {
      isDragging.value = false
      void endDrag(event)

      // Clear Vue node dragging state for selection toolbox
      layoutStore.isDraggingVueNodes.value = false
    }

    // Don't emit node-click when canvas is in panning mode - forward to canvas instead
    if (!shouldHandleNodePointerEvents.value) {
      forwardEventToCanvas(event)
      return
    }

    // Emit node-click for selection handling in GraphCanvas
    const dx = event.clientX - lastX.value
    const dy = event.clientY - lastY.value
    const wasDragging = Math.hypot(dx, dy) > DRAG_THRESHOLD_PX
    onPointerUp(event, nodeData, wasDragging)
  }
  return {
    isDragging,
    dragStyle,
    handlePointerMove,
    handlePointerDown,
    handlePointerUp
  }
}
