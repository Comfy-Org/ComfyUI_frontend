import type { LGraphNode } from '@comfyorg/litegraph'

import Load3d from '@/extensions/core/load3d/Load3d'
import Load3dAnimation from '@/extensions/core/load3d/Load3dAnimation'

export class Load3dService {
  private static instance: Load3dService
  private nodeToLoad3dMap = new Map<LGraphNode, Load3d | Load3dAnimation>()

  private constructor() {}

  static getInstance(): Load3dService {
    if (!Load3dService.instance) {
      Load3dService.instance = new Load3dService()
    }
    return Load3dService.instance
  }

  registerLoad3d(
    node: LGraphNode,
    container: HTMLElement,
    type: 'Load3D' | 'Load3DAnimation' | 'Preview3D' | 'Preview3DAnimation'
  ) {
    if (this.nodeToLoad3dMap.has(node)) {
      this.removeLoad3d(node)
    }

    const isAnimation = type.includes('Animation')

    const Load3dClass = isAnimation ? Load3dAnimation : Load3d

    const isPreview = type.includes('Preview')

    const instance = new Load3dClass(container, { createPreview: !isPreview })

    this.nodeToLoad3dMap.set(node, instance)

    return instance
  }

  getLoad3d(node: LGraphNode): Load3d | Load3dAnimation | null {
    return this.nodeToLoad3dMap.get(node) || null
  }

  getNodeByLoad3d(load3d: Load3d | Load3dAnimation): LGraphNode | null {
    for (const [node, instance] of this.nodeToLoad3dMap) {
      if (instance === load3d) {
        return node
      }
    }
    return null
  }

  removeLoad3d(node: LGraphNode) {
    const instance = this.nodeToLoad3dMap.get(node)
    if (instance) {
      instance.remove()
      this.nodeToLoad3dMap.delete(node)
    }
  }

  clear() {
    for (const [node] of this.nodeToLoad3dMap) {
      this.removeLoad3d(node)
    }
  }
}

export const useLoad3dService = () => {
  return Load3dService.getInstance()
}
