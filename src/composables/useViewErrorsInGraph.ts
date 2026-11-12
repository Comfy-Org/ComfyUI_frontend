import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { useErrorsTabRequestStore } from '@/platform/workflowErrors/panel/errorsTabRequestStore'

export function useViewErrorsInGraph() {
  const canvasStore = useCanvasStore()
  const executionErrorStore = useExecutionErrorStore()
  const rightSidePanelStore = useRightSidePanelStore()
  const errorsTabRequestStore = useErrorsTabRequestStore()

  function viewErrorsInGraph(groupKeys: readonly string[]) {
    canvasStore.linearMode = false
    if (canvasStore.canvas) {
      canvasStore.canvas.deselectAll()
    }

    if (rightSidePanelStore.openPanel('errors')) {
      errorsTabRequestStore.requestDetails(groupKeys)
    }
    executionErrorStore.dismissErrorOverlay()
  }

  return { viewErrorsInGraph }
}
