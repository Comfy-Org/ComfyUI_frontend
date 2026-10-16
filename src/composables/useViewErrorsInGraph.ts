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
    }

    rightSidePanelStore.openPanel('errors')
    rightSidePanelStore.requestErrorDetails()
    executionErrorStore.dismissErrorOverlay()
  }

  return { viewErrorsInGraph }
}
