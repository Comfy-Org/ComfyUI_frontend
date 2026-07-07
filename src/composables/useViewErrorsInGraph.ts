import { nextTick } from 'vue'

import { useAppMode } from '@/composables/useAppMode'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCommandStore } from '@/stores/commandStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useErrorResolutionStore } from '@/stores/workspace/errorResolutionStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'

export function useViewErrorsInGraph() {
  const canvasStore = useCanvasStore()
  const commandStore = useCommandStore()
  const executionErrorStore = useExecutionErrorStore()
  const errorResolutionStore = useErrorResolutionStore()
  const rightSidePanelStore = useRightSidePanelStore()
  const { isAppMode } = useAppMode()

  /**
   * Wait until the canvas backing store reflects the now-visible container.
   * While app mode is shown, the canvas container is display:none and the
   * ResizeObserver in app.ts zeroes the canvas size; fitting before it
   * re-measures would compute a broken (zero/NaN) scale.
   */
  async function waitForCanvasResize() {
    const canvasElement = canvasStore.canvas?.canvas
    if (!canvasElement) return false
    const maxFrames = 30
    for (let frame = 0; frame < maxFrames; frame++) {
      if (canvasElement.width > 0 && canvasElement.height > 0) return true
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })
    }
    return canvasElement.width > 0 && canvasElement.height > 0
  }

  /** Fit the whole graph into the now-visible canvas. */
  async function prepareErrorResolutionCanvas() {
    await nextTick()
    if (!(await waitForCanvasResize())) return
    // The resize wait spans frames; the user may have already left the view
    if (!errorResolutionStore.isActive) return
    await commandStore.execute('Comfy.Canvas.FitView')
  }

  function viewErrorsInGraph() {
    const fromAppMode = isAppMode.value
    canvasStore.linearMode = false
    if (canvasStore.canvas) {
      canvasStore.canvas.deselectAll()
      canvasStore.updateSelectedItems()
    }

    if (fromAppMode) {
      errorResolutionStore.enter()
      void prepareErrorResolutionCanvas()
    } else {
      rightSidePanelStore.openPanel('errors')
    }
    executionErrorStore.dismissErrorOverlay()
  }

  return { viewErrorsInGraph }
}
