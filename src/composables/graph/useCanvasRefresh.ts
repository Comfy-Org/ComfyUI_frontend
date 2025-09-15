// call nextTick on all changeTracker
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useWorkflowStore } from '@/stores/workflowStore'

/**
 * Composable for refreshing nodes in the graph
 * */
export function useCanvasRefresh() {
  const canvasStore = useCanvasStore()
  const workflowStore = useWorkflowStore()
  const refreshCanvas = () => {
    canvasStore.canvas?.emitBeforeChange()
    canvasStore.canvas?.setDirty(true, true)
    canvasStore.canvas?.graph?.afterChange()
    canvasStore.canvas?.emitAfterChange()
    workflowStore.activeWorkflow?.changeTracker?.checkState()
  }

  return {
    refreshCanvas
  }
}
