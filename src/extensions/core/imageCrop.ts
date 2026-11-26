import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { ComfyExtension } from '@/types/comfy'

export const imageCropExtension: ComfyExtension = {
  name: 'Comfy.ImageCrop',

  async nodeCreated(node: LGraphNode) {
    if (node.constructor.comfyClass !== 'ImageCropV2') return

    node.hideOutputImages = true
    const [oldWidth, oldHeight] = node.size
    node.setSize([Math.max(oldWidth, 300), Math.max(oldHeight, 450)])
  }
}
