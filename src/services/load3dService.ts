import type { LGraphNode } from '@comfyorg/litegraph'
import { toRaw } from 'vue'

import Load3d from '@/extensions/core/load3d/Load3d'
import Load3dAnimation from '@/extensions/core/load3d/Load3dAnimation'
import type { CustomInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

type Load3dReadyCallback = (load3d: Load3d | Load3dAnimation) => void

export class Load3dService {
  private static instance: Load3dService
  private nodeToLoad3dMap = new Map<LGraphNode, Load3d | Load3dAnimation>()
  private pendingCallbacks = new Map<LGraphNode, Load3dReadyCallback[]>()

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
    inputSpec: CustomInputSpec
  ) {
    const rawNode = toRaw(node)

    if (this.nodeToLoad3dMap.has(rawNode)) {
      this.removeLoad3d(rawNode)
    }

    const type = inputSpec.type

    const isAnimation = type.includes('Animation')

    const Load3dClass = isAnimation ? Load3dAnimation : Load3d

    const instance = new Load3dClass(container, {
      node: rawNode,
      inputSpec: inputSpec
    })

    rawNode.onMouseEnter = function () {
      instance.refreshViewport()

      instance.updateStatusMouseOnNode(true)
    }

    rawNode.onMouseLeave = function () {
      instance.updateStatusMouseOnNode(false)
    }

    rawNode.onResize = function () {
      instance.handleResize()
    }

    rawNode.onDrawBackground = function () {
      instance.renderer.domElement.hidden = this.flags.collapsed ?? false
    }

    this.nodeToLoad3dMap.set(rawNode, instance)

    const callbacks = this.pendingCallbacks.get(rawNode)

    if (callbacks) {
      callbacks.forEach((callback) => callback(instance))
      this.pendingCallbacks.delete(rawNode)
    }

    return instance
  }

  getLoad3d(node: LGraphNode): Load3d | Load3dAnimation | null {
    const rawNode = toRaw(node)

    return this.nodeToLoad3dMap.get(rawNode) || null
  }

  waitForLoad3d(node: LGraphNode, callback: Load3dReadyCallback): void {
    const rawNode = toRaw(node)

    const existingInstance = this.nodeToLoad3dMap.get(rawNode)

    if (existingInstance) {
      callback(existingInstance)

      return
    }

    if (!this.pendingCallbacks.has(rawNode)) {
      this.pendingCallbacks.set(rawNode, [])
    }

    this.pendingCallbacks.get(rawNode)!.push(callback)
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
    const rawNode = toRaw(node)

    const instance = this.nodeToLoad3dMap.get(rawNode)

    if (instance) {
      instance.remove()

      this.nodeToLoad3dMap.delete(rawNode)
    }

    this.pendingCallbacks.delete(rawNode)
  }

  clear() {
    for (const [node] of this.nodeToLoad3dMap) {
      this.removeLoad3d(node)
    }
    this.pendingCallbacks.clear()
  }
}

export const useLoad3dService = () => {
  return Load3dService.getInstance()
}
