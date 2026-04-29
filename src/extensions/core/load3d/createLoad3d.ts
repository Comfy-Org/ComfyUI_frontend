import * as THREE from 'three'

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

function createRenderer(container: Element | HTMLElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  renderer.setSize(300, 300)
  renderer.setClearColor(0x282828)
  renderer.autoClear = false
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.domElement.classList.add(
    'absolute',
    'inset-0',
    'h-full',
    'w-full',
    'outline-none'
  )
  container.appendChild(renderer.domElement)
  return renderer
}

function buildLoad3dDeps(
  container: Element | HTMLElement,
  options?: Load3DOptions
): Load3dDeps {
  const renderer = createRenderer(container)
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
    renderer,
    getActiveCamera,
    getControls,
    eventManager
  )

  cameraManager = new CameraManager(renderer, eventManager)
  controlsManager = new ControlsManager(
    renderer,
    cameraManager.activeCamera,
    eventManager
  )
  cameraManager.setControls(controlsManager.controls)

  const lightingManager = new LightingManager(sceneManager.scene, eventManager)
  const hdriManager = new HDRIManager(
    sceneManager.scene,
    renderer,
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
    renderer,
    eventManager,
    getActiveCamera,
    (size, center) => cameraManager.setupForModel(size, center),
    (model) => gizmoManager.setupForModel(model),
    () => adapterRef.current?.capabilities ?? DEFAULT_MODEL_CAPABILITIES,
    (model) => adapterRef.current?.computeBounds?.(model) ?? null,
    (model) => adapterRef.current?.disposeModel?.(model),
    () => adapterRef.current?.defaultCameraPose?.() ?? null
  )

  const loaderManager = new LoaderManager(
    modelManager,
    eventManager,
    undefined,
    adapterRef,
    options?.suppressLoadErrors ?? false
  )
  const recordingManager = new RecordingManager(
    sceneManager.scene,
    renderer,
    eventManager
  )
  const animationManager = new AnimationManager(eventManager)

  gizmoManager = new GizmoManager(
    sceneManager.scene,
    renderer,
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
    renderer,
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
  container: Element | HTMLElement,
  options?: Load3DOptions
): Load3d {
  return new Load3d(container, buildLoad3dDeps(container, options), options)
}
