import type { LGraphNode } from '@comfyorg/litegraph'

import { useNodeOutputStore } from '@/stores/imagePreviewStore'

/**
 * Attaches a preview image to a node.
 */
export const useNodeImage = (node: LGraphNode) => {
  const nodeOutputStore = useNodeOutputStore()

  /** Displays output image(s) on the node. */
  function showImage(output: string | string[]) {
    if (!output) return
    nodeOutputStore.setNodeOutputs(node, output)
    node.setSizeForImage?.()
    node.graph?.setDirtyCanvas(true)
  }

  return {
    showImage
  }
}
