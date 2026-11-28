import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { ComfyExtension } from '@/types/comfy'

const NODE_CLASS = 'CameraAngle'
const MIN_WIDTH = 360
const MIN_HEIGHT = 480

export const cameraAngleExtension: ComfyExtension = {
  name: 'Comfy.CameraAngle',

  nodeCreated(node: LGraphNode) {
    if (node.constructor.comfyClass !== NODE_CLASS) return
    const [width, height] = node.size
    node.setSize([Math.max(width, MIN_WIDTH), Math.max(height, MIN_HEIGHT)])
  }
}
