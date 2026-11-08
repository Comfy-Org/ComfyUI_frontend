import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

export function useViewErrorsInGraph() {
  const canvasStore = useCanvasStore()
  const executionErrorStore = useExecutionErrorStore()
  const rightSidePanelStore = useRightSidePanelStore()

  function viewErrorsInGraph(groupKeys: readonly string[]) {
    useAgentPanelStore().exitFullscreen('view_errors')
    canvasStore.linearMode = false
    if (canvasStore.canvas) {
      canvasStore.canvas.deselectAll()
    }

    rightSidePanelStore.openPanel('errors')
    rightSidePanelStore.requestErrorDetails(groupKeys)
    executionErrorStore.dismissErrorOverlay()
  }

  return { viewErrorsInGraph }
}
