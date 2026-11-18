import type { ComfyExtension } from '@/types/comfy'

export const lightInfoExtension: ComfyExtension = {
  name: 'Comfy.CreateLightInfo',

  nodeCreated(node) {
    if (node.constructor.comfyClass !== 'CreateLightInfo') return

    const [oldWidth, oldHeight] = node.size
    node.setSize([Math.max(oldWidth, 360), Math.max(oldHeight, 580)])
  }
}
