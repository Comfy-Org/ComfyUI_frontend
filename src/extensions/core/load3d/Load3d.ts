import { LGraphNode } from '@comfyorg/litegraph'
import * as THREE from 'three'

import { CameraManager } from './CameraManager'
import { ControlsManager } from './ControlsManager'
import { EventManager } from './EventManager'
import { LightingManager } from './LightingManager'
import { LoaderManager } from './LoaderManager'
import { ModelManager } from './ModelManager'
import { NodeStorage } from './NodeStorage'
import { PreviewManager } from './PreviewManager'
import { SceneManager } from './SceneManager'
import { ViewHelperManager } from './ViewHelperManager'
import {
  CameraState,
  CaptureResult,
  Load3DOptions,
  MaterialMode,
  UpDirection
} from './interfaces'

class Load3d {
  renderer: THREE.WebGLRenderer
  protected clock: THREE.Clock
  protected animationFrameId: number | null = null
  protected node: LGraphNode

  protected eventManager: EventManager
  protected nodeStorage: NodeStorage
  protected sceneManager: SceneManager
  protected cameraManager: CameraManager
  protected controlsManager: ControlsManager
  protected lightingManager: LightingManager
  protected viewHelperManager: ViewHelperManager
  protected previewManager: PreviewManager
  protected loaderManager: LoaderManager
  protected modelManager: ModelManager

  constructor(
    container: Element | HTMLElement,
    options: Load3DOptions = {
      node: {} as LGraphNode
    }
  ) {
    this.node = options.node || ({} as LGraphNode)
    this.clock = new THREE.Clock()

    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    this.renderer.setSize(300, 300)
    this.renderer.setClearColor(0x282828)
    this.renderer.autoClear = false
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(this.renderer.domElement)

    this.eventManager = new EventManager()
    this.nodeStorage = new NodeStorage(this.node)

    this.sceneManager = new SceneManager(
      this.renderer,
      this.getActiveCamera.bind(this),
      this.getControls.bind(this),
      this.eventManager
    )

    this.cameraManager = new CameraManager(
      this.renderer,
      this.eventManager,
      this.nodeStorage
    )

    this.controlsManager = new ControlsManager(
      this.renderer,
      this.cameraManager.activeCamera,
      this.eventManager,
      this.nodeStorage
    )

    this.cameraManager.setControls(this.controlsManager.controls)

    this.lightingManager = new LightingManager(
      this.sceneManager.scene,
      this.eventManager
    )

    this.viewHelperManager = new ViewHelperManager(
      this.renderer,
      this.getActiveCamera.bind(this),
      this.getControls.bind(this),
      this.nodeStorage
    )

    this.previewManager = new PreviewManager(
      this.sceneManager.scene,
      this.getActiveCamera.bind(this),
      this.getControls.bind(this),
      () => this.renderer,
      this.eventManager,
      this.sceneManager.backgroundScene,
      this.sceneManager.backgroundCamera
    )

    this.modelManager = new ModelManager(
      this.sceneManager.scene,
      this.renderer,
      this.eventManager,
      this.getActiveCamera.bind(this),
      this.setupCamera.bind(this)
    )

    this.loaderManager = new LoaderManager(this.modelManager, this.eventManager)

    this.sceneManager.init()
    this.cameraManager.init()
    this.controlsManager.init()
    this.lightingManager.init()
    this.loaderManager.init()
    this.loaderManager.init()

    this.viewHelperManager.createViewHelper(container)
    this.viewHelperManager.init()

    if (options && options.createPreview) {
      this.previewManager.createCapturePreview(container)
      this.previewManager.init()
    }

    this.handleResize()
    this.startAnimation()
  }

  private getActiveCamera(): THREE.Camera {
    return this.cameraManager.activeCamera
  }

  private getControls() {
    return this.controlsManager.controls
  }

  private setupCamera(size: THREE.Vector3): void {
    this.cameraManager.setupForModel(size)
  }

  private startAnimation(): void {
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate)

      if (this.previewManager.showPreview) {
        this.previewManager.updatePreviewRender()
      }

      const delta = this.clock.getDelta()
      this.viewHelperManager.update(delta)
      this.controlsManager.update()

      this.renderer.clear()
      this.sceneManager.renderBackground()
      this.renderer.render(
        this.sceneManager.scene,
        this.cameraManager.activeCamera
      )

      if (this.viewHelperManager.viewHelper.render) {
        this.viewHelperManager.viewHelper.render(this.renderer)
      }
    }

    animate()
  }

  setBackgroundColor(color: string): void {
    this.sceneManager.setBackgroundColor(color)
    this.renderer.render(
      this.sceneManager.scene,
      this.cameraManager.activeCamera
    )
  }

  async setBackgroundImage(uploadPath: string): Promise<void> {
    await this.sceneManager.setBackgroundImage(uploadPath)

    if (this.previewManager.previewRenderer) {
      this.previewManager.updateBackgroundTexture(
        this.sceneManager.backgroundTexture
      )
    }
  }

  removeBackgroundImage(): void {
    this.sceneManager.removeBackgroundImage()

    if (
      this.previewManager.previewRenderer &&
      this.previewManager.previewCamera
    ) {
      this.previewManager.updateBackgroundTexture(null)
    }
  }

  toggleGrid(showGrid: boolean): void {
    this.sceneManager.toggleGrid(showGrid)
  }

  toggleCamera(cameraType?: 'perspective' | 'orthographic'): void {
    this.cameraManager.toggleCamera(cameraType)

    this.controlsManager.updateCamera(this.cameraManager.activeCamera)
    this.viewHelperManager.recreateViewHelper()

    this.handleResize()
  }

  getCurrentCameraType(): 'perspective' | 'orthographic' {
    return this.cameraManager.getCurrentCameraType()
  }

  setCameraState(state: CameraState): void {
    this.cameraManager.setCameraState(state)
  }

  getCameraState(): CameraState {
    return this.cameraManager.getCameraState()
  }

  setFOV(fov: number): void {
    this.cameraManager.setFOV(fov)
    this.renderer.render(
      this.sceneManager.scene,
      this.cameraManager.activeCamera
    )
  }

  setMaterialMode(mode: MaterialMode): void {
    this.modelManager.setMaterialMode(mode)

    this.renderer.render(
      this.sceneManager.scene,
      this.cameraManager.activeCamera
    )
  }

  async loadModel(url: string, originalFileName?: string): Promise<void> {
    this.cameraManager.reset()
    this.controlsManager.reset()
    this.modelManager.reset()

    await this.loaderManager.loadModel(url, originalFileName)

    this.handleResize()
  }

  clearModel(): void {
    this.modelManager.clearModel()
  }

  setUpDirection(direction: UpDirection): void {
    this.modelManager.setUpDirection(direction)

    this.renderer.render(
      this.sceneManager.scene,
      this.cameraManager.activeCamera
    )
  }

  setLightIntensity(intensity: number): void {
    this.lightingManager.setLightIntensity(intensity)
  }

  togglePreview(showPreview: boolean): void {
    this.previewManager.togglePreview(showPreview)
  }

  setTargetSize(width: number, height: number): void {
    this.previewManager.setTargetSize(width, height)
  }

  addEventListener(event: string, callback: (data?: any) => void): void {
    this.eventManager.addEventListener(event, callback)
  }

  removeEventListener(event: string, callback: (data?: any) => void): void {
    this.eventManager.removeEventListener(event, callback)
  }

  refreshViewport(): void {
    this.handleResize()
  }

  handleResize(): void {
    const parentElement = this.renderer?.domElement?.parentElement

    if (!parentElement) {
      console.warn('Parent element not found')
      return
    }

    const width = parentElement.clientWidth
    const height = parentElement.clientHeight

    this.cameraManager.handleResize(width, height)
    this.sceneManager.handleResize(width, height)

    this.renderer.setSize(width, height)

    this.previewManager.handleResize()
  }

  captureScene(width: number, height: number): Promise<CaptureResult> {
    return this.sceneManager.captureScene(width, height)
  }

  loadNodeProperty(name: string, defaultValue: any) {
    return this.nodeStorage.loadNodeProperty(name, defaultValue)
  }

  remove(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
    }

    this.sceneManager.dispose()
    this.cameraManager.dispose()
    this.controlsManager.dispose()
    this.lightingManager.dispose()
    this.viewHelperManager.dispose()
    this.previewManager.dispose()
    this.loaderManager.dispose()
    this.modelManager.dispose()

    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}

export default Load3d
