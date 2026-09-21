import { onTestFinished, vi } from 'vitest'
import { ref, shallowRef } from 'vue'

import type { useNodeDragToCanvas as realUseNodeDragToCanvas } from '../useNodeDragToCanvas'

const nodeDragToCanvas: ReturnType<typeof realUseNodeDragToCanvas> = {
  isDragging: ref(false),
  draggedNode: shallowRef(null),
  pendingWidgetValues: shallowRef(),
  startDrag: vi.fn(),
  cancelDrag: vi.fn(),
  handleNativeDrop: vi.fn()
}

export const useNodeDragToCanvas = vi.fn(() => {
  onTestFinished(() => {
    nodeDragToCanvas.isDragging.value = false
    nodeDragToCanvas.draggedNode.value = null
    nodeDragToCanvas.pendingWidgetValues.value = undefined
  })
  return nodeDragToCanvas
})
