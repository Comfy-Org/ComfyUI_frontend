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
  const nodeImages = useNodeOutputStore()

  /** Displays output image(s) on the node. */
  function showImage(output: string | string[]) {
    if (!output) return
    if (allowBatch || typeof output === 'string') {
      nodeImages.setNodeOutputs(node, output)
    } else {
      nodeImages.setNodeOutputs(node, output[0])
    }
    node.setSizeForImage?.()
    node.graph?.setDirtyCanvas(true)
  }

  return {
    showImage
  }
}
