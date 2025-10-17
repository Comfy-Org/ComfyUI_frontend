import { useEventListener } from '@vueuse/core'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { isEventTargetInGraph } from '@/workbench/eventHelpers'

/**
 * Adds a handler on copy that serializes selected nodes to JSON
 */
export const useCopy = () => {
  const canvasStore = useCanvasStore()

  useEventListener(document, 'copy', (e) => {
    if (!(e.target instanceof Element)) {
      return
    }
    if (
      (e.target instanceof HTMLTextAreaElement &&
        e.target.type === 'textarea') ||
      (e.target instanceof HTMLInputElement && e.target.type === 'text')
    ) {
      // Default system copy
      return
    }
    // Check if target is graph canvas or within graph UI (minimap, controls, etc.)
    if (!isEventTargetInGraph(e.target)) {
      return
    }

    // copy nodes and clear clipboard
    const canvas = canvasStore.canvas
    if (canvas?.selectedItems) {
      canvas.copyToClipboard()
      // clearData doesn't remove images from clipboard
      e.clipboardData?.setData('text', ' ')
      e.preventDefault()
      e.stopImmediatePropagation()
      return false
    }
  })
}
