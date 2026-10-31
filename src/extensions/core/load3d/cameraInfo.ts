import { nextTick } from 'vue'

import type { LGraphNode } from '@comfyorg/litegraph/LGraphNode'
import type { ComfyExtension } from '@/types/comfy'

export const cameraInfoExtension: ComfyExtension = {
  name: 'Comfy.CreateCameraInfo',

  async nodeCreated(node: LGraphNode) {
    if (node.constructor.comfyClass !== 'CreateCameraInfo') return

    const [oldWidth, oldHeight] = node.size
    node.setSize([Math.max(oldWidth, 360), Math.max(oldHeight, 480)])

    await nextTick()
  }
}
