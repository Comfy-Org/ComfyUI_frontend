import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { usePropertiesPanelStore } from '@/renderer/extensions/propertiesPanel/propertiesPanelStore'
import { useErrorsTabRequestStore } from '@/platform/workflowErrors/panel/errorsTabRequestStore'

export function useViewErrorsInGraph() {
  const canvasStore = useCanvasStore()
  const executionErrorStore = useExecutionErrorStore()
  const propertiesPanelStore = usePropertiesPanelStore()
  const errorsTabRequestStore = useErrorsTabRequestStore()

  function viewErrorsInGraph(groupKeys: readonly string[]) {
    canvasStore.linearMode = false
    if (canvasStore.canvas) {
      canvasStore.canvas.deselectAll()
    }

    if (propertiesPanelStore.openPanel('errors')) {
      errorsTabRequestStore.requestDetails(groupKeys)
    }
    executionErrorStore.dismissErrorOverlay()
  }

  return { viewErrorsInGraph }
}
