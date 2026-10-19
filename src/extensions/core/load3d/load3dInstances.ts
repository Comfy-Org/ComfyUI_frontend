import { toRaw } from 'vue'
import type { Object3D } from 'three'

import type Load3d from '@comfyorg/viewport3d/load3d/Load3d'
import { adoptClonedModel } from '@comfyorg/viewport3d/load3d/quadWireframe/adoptClonedModel'
import { cloneObject3DResources } from '@comfyorg/viewport3d/load3d/SceneModelManager'
import { reportLoadModelOutcome } from '@/extensions/core/load3d/reportLoadModelOutcome'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

type SkeletonUtilsModule = { clone: (source: Object3D) => Object3D }

interface SceneConfig {
  backgroundImage?: string
}

let cachedNodeToLoad3dMap: Map<LGraphNode, Load3d> | null = null
let cachedSkeletonUtils: SkeletonUtilsModule | null = null

/** Returns null until `useLoad3dService().getLoad3dAsync` has loaded the map. */
export function getNodeToLoad3dMapSync(): Map<LGraphNode, Load3d> | null {
  return cachedNodeToLoad3dMap
}

export function cacheNodeToLoad3dMap(map: Map<LGraphNode, Load3d>): void {
  cachedNodeToLoad3dMap = map
}

async function loadSkeletonUtils() {
  if (!cachedSkeletonUtils) {
    cachedSkeletonUtils = await import('three/examples/jsm/utils/SkeletonUtils')
  }
  return cachedSkeletonUtils
}

export function getNodeByLoad3d(load3d: Load3d): LGraphNode | null {
  const map = getNodeToLoad3dMapSync()
  if (!map) return null
  for (const [node, instance] of map) {
    if (instance === load3d) {
      return node
    }
  }
  return null
}

export function removeLoad3d(node: LGraphNode) {
  const rawNode = toRaw(node)
  const map = getNodeToLoad3dMapSync()
  if (!map) return

  const instance = map.get(rawNode)

  if (instance) {
    instance.remove()
    map.delete(rawNode)
  }
}

export async function copyLoad3dState(source: Load3d, target: Load3d) {
  const sourceModel = source.modelManager.currentModel

  const gizmoWasEnabled = target.getGizmoManager().isEnabled()
  const showSkeleton = target.getModelManager().showSkeleton
  target.getGizmoManager().detach()

  if (sourceModel) {
    target.getModelManager().disposeCurrentModel()

    if (source.isSplatModel()) {
      const originalURL = source.modelManager.originalURL
      if (originalURL) {
        const outcome = await target.loadModel(originalURL)
        reportLoadModelOutcome(outcome)
        if (outcome !== 'loaded') return
      }
    } else {
      const SkeletonUtils = await loadSkeletonUtils()
      const modelClone = SkeletonUtils.clone(sourceModel)
      adoptClonedModel(
        modelClone,
        sourceModel,
        source.getModelManager().originalMaterials
      )
      cloneObject3DResources(modelClone)
      target.getModelManager().materialMode = 'original'

      target.getModelManager().currentModel = modelClone
      target.getSceneManager().scene.add(modelClone)
      target.getModelManager().setupModelMaterials(modelClone)

      const sourceOriginalModel = source.getModelManager().originalModel

      if (sourceOriginalModel) {
        target.getModelManager().originalModel = sourceOriginalModel
      }

      target.getModelManager().currentUpDirection =
        source.getModelManager().currentUpDirection

      const appliedTexture = source.getModelManager().appliedTexture
      if (appliedTexture) {
        target
          .getModelManager()
          .borrowAppliedTexture(appliedTexture.clone(), true)
      }

      target.setMaterialMode(source.getModelManager().materialMode)
      target.setUpDirection(source.getModelManager().currentUpDirection)
      target.setShowSkeleton(showSkeleton)

      const sourceInitial = source.getGizmoManager().getInitialTransform()
      modelClone.position.set(
        sourceInitial.position.x,
        sourceInitial.position.y,
        sourceInitial.position.z
      )
      modelClone.rotation.set(
        sourceInitial.rotation.x,
        sourceInitial.rotation.y,
        sourceInitial.rotation.z
      )
      modelClone.scale.set(
        sourceInitial.scale.x,
        sourceInitial.scale.y,
        sourceInitial.scale.z
      )

      target.getGizmoManager().setupForModel(modelClone)
      const gizmoTransform = source.getGizmoTransform()
      target.applyGizmoTransform(
        gizmoTransform.position,
        gizmoTransform.rotation,
        gizmoTransform.scale
      )
      const shouldEnable =
        gizmoWasEnabled || source.getGizmoManager().isEnabled()
      if (shouldEnable) {
        target.setGizmoEnabled(true)
      }

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
    const sourceNode = getNodeByLoad3d(source)
    const sceneConfig = sourceNode?.properties['Scene Config'] as
      | SceneConfig
      | undefined
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

export function handleViewportRefresh(load3d: Load3d | null) {
  if (!load3d) return

  load3d.handleResize()

  const currentType = load3d.getCurrentCameraType()

  load3d.toggleCamera(
    currentType === 'perspective' ? 'orthographic' : 'perspective'
  )
  load3d.toggleCamera(currentType)

  load3d.getControlsManager().controls.update()
}
