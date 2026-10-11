import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useExtensionService } from '@/services/extensionService'

useExtensionService().registerExtension({
  name: 'Comfy.ImageCompare',

  async nodeCreated(node: LGraphNode) {
    if (node.constructor.comfyClass !== 'ImageCompare') return

    const [oldWidth, oldHeight] = node.size
    node.setSize([Math.max(oldWidth, 400), Math.max(oldHeight, 350)])
  }
})
