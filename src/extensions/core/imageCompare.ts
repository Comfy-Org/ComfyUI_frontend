import type { LGraphNode } from '@comfyorg/litegraph/LGraphNode'
import type { ComfyExtension } from '@/types/comfy'

export const imageCompareExtension: ComfyExtension = {
  name: 'Comfy.ImageCompare',

  async nodeCreated(node: LGraphNode) {
    if (node.constructor.comfyClass !== 'ImageCompare') return

    const [oldWidth, oldHeight] = node.size
    node.setSize([Math.max(oldWidth, 400), Math.max(oldHeight, 350)])
  }
}
