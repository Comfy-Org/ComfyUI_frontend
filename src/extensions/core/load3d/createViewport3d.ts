import type * as THREE from 'three'

import { RendererView } from '@/renderer/three/RendererView'

import { CameraManager } from './CameraManager'
import { ControlsManager } from './ControlsManager'
import { EventManager } from './EventManager'
import { LightingManager } from './LightingManager'
import { SceneManager } from './SceneManager'
import { ViewHelperManager } from './ViewHelperManager'
import { Viewport3d } from './Viewport3d'
import type { Viewport3dDeps } from './Viewport3d'
import type { Load3DOptions } from './interfaces'

function buildViewport3dDeps(container: HTMLElement): Viewport3dDeps {
  const view = new RendererView(container)
  const renderer = view.renderer
  const eventManager = new EventManager()

  let cameraManager: CameraManager
  let controlsManager: ControlsManager

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
  const viewHelperManager = new ViewHelperManager(
    renderer,
    getActiveCamera,
    getControls,
    eventManager
  )

  return {
    view,
    eventManager,
    sceneManager,
    cameraManager,
    controlsManager,
    lightingManager,
    viewHelperManager
  }
}

export function createViewport3d(
  container: HTMLElement,
  options?: Load3DOptions
): Viewport3d {
  const viewport = new Viewport3d(
    container,
    buildViewport3dDeps(container),
    options
  )
  viewport.start()
  return viewport
}
