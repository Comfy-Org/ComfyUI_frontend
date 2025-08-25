import { toRaw } from 'vue'

import { useLoad3dViewer } from '@/composables/useLoad3dViewer'
import Load3d from '@/extensions/core/load3d/Load3d'
import Load3dAnimation from '@/extensions/core/load3d/Load3dAnimation'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { NodeId } from '@/schemas/comfyWorkflowSchema'
import type { CustomInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

type Load3dReadyCallback = (load3d: Load3d | Load3dAnimation) => void

const viewerInstances = new Map<NodeId, any>()

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

  getOrCreateViewer(node: LGraphNode) {
    if (!viewerInstances.has(node.id)) {
      viewerInstances.set(node.id, useLoad3dViewer(node))
    }

    return viewerInstances.get(node.id)
  }

  removeViewer(node: LGraphNode) {
    const viewer = viewerInstances.get(node.id)

    if (viewer) {
      viewer.cleanup()
    }

    viewerInstances.delete(node.id)
  }

  async copyLoad3dState(source: Load3d, target: Load3d | Load3dAnimation) {
    const sourceModel = source.modelManager.currentModel

    if (sourceModel) {
      const modelClone = sourceModel.clone()

      target.getModelManager().currentModel = modelClone
      target.getSceneManager().scene.add(modelClone)

      target.getModelManager().materialMode =
        source.getModelManager().materialMode

      target.getModelManager().currentUpDirection =
        source.getModelManager().currentUpDirection

      target.setMaterialMode(source.getModelManager().materialMode)
      target.setUpDirection(source.getModelManager().currentUpDirection)

      if (source.getModelManager().appliedTexture) {
        target.getModelManager().appliedTexture =
          source.getModelManager().appliedTexture
      }
    }

    const sourceCameraType = source.getCurrentCameraType()
    const sourceCameraState = source.getCameraState()

    target.toggleCamera(sourceCameraType)
    target.setCameraState(sourceCameraState)

    target.setBackgroundColor(source.getSceneManager().currentBackgroundColor)

    target.toggleGrid(source.getSceneManager().gridHelper.visible)

    const sourceBackgroundInfo = source
      .getSceneManager()
      .getCurrentBackgroundInfo()
    if (sourceBackgroundInfo.type === 'image') {
      const sourceNode = this.getNodeByLoad3d(source)
      const backgroundPath = sourceNode?.properties?.[
        'Background Image'
      ] as string
      if (backgroundPath) {
        await target.setBackgroundImage(backgroundPath)
      }
    }

    target.setLightIntensity(
      source.getLightingManager().lights[1]?.intensity || 1
    )

    if (sourceCameraType === 'perspective') {
      target.setFOV(source.getCameraManager().perspectiveCamera.fov)
    }

    const sourceNode = this.getNodeByLoad3d(source)
    if (sourceNode?.properties?.['Edge Threshold']) {
      target.setEdgeThreshold(sourceNode.properties['Edge Threshold'] as number)
    }
  }

  handleViewportRefresh(load3d: Load3d | null) {
    if (!load3d) return

    load3d.handleResize()

    const currentType = load3d.getCurrentCameraType()

    load3d.toggleCamera(
      currentType === 'perspective' ? 'orthographic' : 'perspective'
    )
    load3d.toggleCamera(currentType)

    load3d.getControlsManager().controls.update()
  }

  async handleViewerClose(node: LGraphNode) {
    const viewer = useLoad3dService().getOrCreateViewer(node)

    if (viewer.needApplyChanges.value) {
      await viewer.applyChanges()
    }

    useLoad3dService().removeViewer(node)
  }
}

export const useLoad3dService = () => {
  return Load3dService.getInstance()
}
