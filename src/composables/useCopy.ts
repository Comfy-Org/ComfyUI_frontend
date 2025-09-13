import { useEventListener } from '@vueuse/core'

import { useCanvasStore } from '@/stores/graphStore'

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
    const isTargetInGraph =
      e.target.classList.contains('litegraph') ||
      e.target.classList.contains('graph-canvas-container') ||
      e.target.id === 'graph-canvas'

    // copy nodes and clear clipboard
    const canvas = canvasStore.canvas
    if (isTargetInGraph && canvas?.selectedItems) {
      canvas.copyToClipboard()
      // clearData doesn't remove images from clipboard
      e.clipboardData?.setData('text', ' ')
      e.preventDefault()
      e.stopImmediatePropagation()
      return false
    }
  })
}
