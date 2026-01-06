import { toRaw } from 'vue'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils'

import { nodeToLoad3dMap } from '@/composables/useLoad3d'
import { useLoad3dViewer } from '@/composables/useLoad3dViewer'
import type Load3d from '@/extensions/core/load3d/Load3d'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { NodeId } from '@/platform/workflow/validation/schemas/workflowSchema'

const viewerInstances = new Map<NodeId, any>()

export class Load3dService {
  private static instance: Load3dService

  private constructor() {}

  static getInstance(): Load3dService {
    if (!Load3dService.instance) {
      Load3dService.instance = new Load3dService()
    }
    return Load3dService.instance
  }

  getLoad3d(node: LGraphNode): Load3d | null {
    const rawNode = toRaw(node)

    return nodeToLoad3dMap.get(rawNode) || null
  }

  getNodeByLoad3d(load3d: Load3d): LGraphNode | null {
    for (const [node, instance] of nodeToLoad3dMap) {
      if (instance === load3d) {
        return node
      }
    }
    return null
  }

  removeLoad3d(node: LGraphNode) {
    const rawNode = toRaw(node)

    const instance = nodeToLoad3dMap.get(rawNode)

    if (instance) {
      instance.remove()

      nodeToLoad3dMap.delete(rawNode)
    }
  }

  clear() {
    for (const [node] of nodeToLoad3dMap) {
      this.removeLoad3d(node)
    }
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

  async copyLoad3dState(source: Load3d, target: Load3d) {
    const sourceModel = source.modelManager.currentModel

    if (sourceModel) {
      // Remove existing model from target scene before adding new one
      const existingModel = target.getModelManager().currentModel
      if (existingModel) {
        target.getSceneManager().scene.remove(existingModel)
      }

      if (source.isSplatModel()) {
        const originalURL = source.modelManager.originalURL
        if (originalURL) {
          await target.loadModel(originalURL)
        }
      } else {
        // Use SkeletonUtils.clone for proper skeletal animation support
        const modelClone = SkeletonUtils.clone(sourceModel)

        target.getModelManager().currentModel = modelClone
        target.getSceneManager().scene.add(modelClone)

        const sourceOriginalModel = source.getModelManager().originalModel

        if (sourceOriginalModel) {
          target.getModelManager().originalModel = sourceOriginalModel
        }

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

        // Copy animation state
        if (source.hasAnimations()) {
          target.animationManager.setupModelAnimations(
            modelClone,
            sourceOriginalModel
          )
        }
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
      const sceneConfig = sourceNode?.properties?.['Scene Config'] as any
      const backgroundPath = sceneConfig?.backgroundImage
      if (backgroundPath) {
        await target.setBackgroundImage(backgroundPath)
      }
    } else {
      await target.setBackgroundImage('')
    }

    target.setLightIntensity(
      source.getLightingManager().lights[1]?.intensity || 1
    )

    if (sourceCameraType === 'perspective') {
      target.setFOV(source.getCameraManager().perspectiveCamera.fov)
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

      // Sync configuration back to the node's UI
      if ((node as any).syncLoad3dConfig) {
        ;(node as any).syncLoad3dConfig()
      }
    }

    useLoad3dService().removeViewer(node)
  }
}

export const useLoad3dService = () => {
  return Load3dService.getInstance()
}
