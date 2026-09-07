import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'

export function useViewErrorsInGraph() {
  const canvasStore = useCanvasStore()
  const executionErrorStore = useExecutionErrorStore()
  const rightSidePanelStore = useRightSidePanelStore()

  function viewErrorsInGraph() {
    canvasStore.linearMode = false
    if (canvasStore.canvas) {
      canvasStore.canvas.deselectAll()
      canvasStore.updateSelectedItems()
    }

    rightSidePanelStore.openPanel('errors')
    executionErrorStore.dismissErrorOverlay()
  }

  return { viewErrorsInGraph }
}
