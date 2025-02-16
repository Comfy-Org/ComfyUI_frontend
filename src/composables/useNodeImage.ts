import type { LGraphNode } from '@comfyorg/litegraph'

import { useNodeOutputStore } from '@/stores/imagePreviewStore'

interface NodeImageOptions {
  allowBatch?: boolean
}

/**
 * Attaches a preview image to a node.
 */
export const useNodeImage = (node: LGraphNode, options: NodeImageOptions) => {
  const { allowBatch = false } = options
  const nodeOutputStore = useNodeOutputStore()

  /** Displays output image(s) on the node. */
  function showImage(output: string | string[]) {
    if (!output) return
    if (allowBatch || typeof output === 'string') {
      nodeOutputStore.setNodeOutputs(node, output)
    } else {
      nodeOutputStore.setNodeOutputs(node, output[0])
    }
    node.setSizeForImage?.()
    node.graph?.setDirtyCanvas(true)
  }

  return {
    showImage
  }
}
