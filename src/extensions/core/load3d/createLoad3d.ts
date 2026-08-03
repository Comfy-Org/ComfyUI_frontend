import type * as THREE from 'three'

import { RendererView } from '@/renderer/three/RendererView'

import { AnimationManager } from './AnimationManager'
import { CameraManager } from './CameraManager'
import { ControlsManager } from './ControlsManager'
import { EventManager } from './EventManager'
import { GizmoManager } from './GizmoManager'
import { HDRIManager } from './HDRIManager'
import { LightingManager } from './LightingManager'
import Load3d from './Load3d'
import type { Load3dDeps } from './Load3d'
import { LoaderManager } from './LoaderManager'
import { createAdapterRef, DEFAULT_MODEL_CAPABILITIES } from './ModelAdapter'
import { RecordingManager } from './RecordingManager'
import { SceneManager } from './SceneManager'
import { SceneModelManager } from './SceneModelManager'
import { ViewHelperManager } from './ViewHelperManager'
import type { Load3DOptions } from './interfaces'

function buildLoad3dDeps(container: HTMLElement): Load3dDeps {
  const view = new RendererView(container)
  const renderer = view.renderer
  const eventManager = new EventManager()
  // Shared mutable handle: LoaderManager writes the active adapter on each
  // load; SceneModelManager reads it for capability/bounds/dispose lookups
  // without depending on construction order.
  const adapterRef = createAdapterRef()

  let cameraManager: CameraManager
  let controlsManager: ControlsManager
  let gizmoManager: GizmoManager

  const getActiveCamera = (): THREE.Camera => cameraManager.activeCamera
  const getControls = () => controlsManager.controls

  const sceneManager = new SceneManager(
    view,
    getActiveCamera,
    getControls,
    eventManager
  )

  cameraManager = new CameraManager(renderer, eventManager)
  controlsManager = new ControlsManager(
    container,
    cameraManager.activeCamera,
    eventManager
  )
  cameraManager.setControls(controlsManager.controls)

  const lightingManager = new LightingManager(sceneManager.scene, eventManager)
  const hdriManager = new HDRIManager(
    sceneManager.scene,
    renderer,
    view.state,
    eventManager
  )
  const viewHelperManager = new ViewHelperManager(
    renderer,
    getActiveCamera,
    getControls,
    eventManager
  )

  const modelManager = new SceneModelManager(
    sceneManager.scene,
    view.state,
    eventManager,
    getActiveCamera,
    (size, center) => cameraManager.setupForModel(size, center),
    (model) => gizmoManager.setupForModel(model),
    () => adapterRef.capabilities ?? DEFAULT_MODEL_CAPABILITIES,
    (model) => adapterRef.current?.computeBounds?.(model) ?? null,
    (model) => adapterRef.current?.disposeModel?.(model),
    () => adapterRef.current?.defaultCameraPose?.() ?? null
  )

  const loaderManager = new LoaderManager(
    modelManager,
    eventManager,
    undefined,
    adapterRef
  )
  const recordingManager = new RecordingManager(
    sceneManager.scene,
    view.canvas,
    eventManager
  )
  const animationManager = new AnimationManager(eventManager)

  gizmoManager = new GizmoManager(
    sceneManager.scene,
    container,
    controlsManager.controls,
    getActiveCamera,
    () => {
      const transform = gizmoManager.getTransform()
      eventManager.emitEvent('gizmoTransformChange', {
        ...transform,
        enabled: gizmoManager.isEnabled(),
        mode: gizmoManager.getMode()
      })
    }
  )

  return {
    view,
    eventManager,
    sceneManager,
    cameraManager,
    controlsManager,
    lightingManager,
    hdriManager,
    viewHelperManager,
    loaderManager,
    modelManager,
    recordingManager,
    animationManager,
    gizmoManager,
    adapterRef
  }
}

export function createLoad3d(
  container: HTMLElement,
  options?: Load3DOptions
): Load3d {
  return new Load3d(container, buildLoad3dDeps(container), options)
}
