import { LGraphNode } from '@comfyorg/litegraph'
import * as THREE from 'three'

import { CustomInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

import { CameraManager } from './CameraManager'
import { ControlsManager } from './ControlsManager'
import { EventManager } from './EventManager'
import { LightingManager } from './LightingManager'
import { LoaderManager } from './LoaderManager'
import { ModelExporter } from './ModelExporter'
import { ModelManager } from './ModelManager'
import { NodeStorage } from './NodeStorage'
import { PreviewManager } from './PreviewManager'
import { RecordingManager } from './RecordingManager'
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
  node: LGraphNode

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
  protected recordingManager: RecordingManager

  STATUS_MOUSE_ON_NODE: boolean
  STATUS_MOUSE_ON_SCENE: boolean
  INITIAL_RENDER_DONE: boolean = false

  constructor(
    container: Element | HTMLElement,
    options: Load3DOptions = {
      node: {} as LGraphNode,
      inputSpec: {} as CustomInputSpec
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
      this.setupCamera.bind(this),
      options
    )

    this.loaderManager = new LoaderManager(
      this.modelManager,
      this.eventManager,
      options
    )

    this.recordingManager = new RecordingManager(
      this.sceneManager.scene,
      this.renderer,
      this.eventManager
    )
    this.sceneManager.init()
    this.cameraManager.init()
    this.controlsManager.init()
    this.lightingManager.init()
    this.loaderManager.init()
    this.loaderManager.init()

    this.viewHelperManager.createViewHelper(container)
    this.viewHelperManager.init()

    if (options && !options.inputSpec?.isPreview) {
      this.previewManager.createCapturePreview(container)
      this.previewManager.init()
    }

    this.STATUS_MOUSE_ON_NODE = false
    this.STATUS_MOUSE_ON_SCENE = false

    this.handleResize()
    this.startAnimation()

    setTimeout(() => {
      this.forceRender()
    }, 100)
  }

  forceRender(): void {
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

    if (this.previewManager.showPreview) {
      this.previewManager.updatePreviewRender()
    }

    this.INITIAL_RENDER_DONE = true
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

      if (!this.isActive()) {
        return
      }

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

  updateStatusMouseOnNode(onNode: boolean): void {
    this.STATUS_MOUSE_ON_NODE = onNode
  }

  updateStatusMouseOnScene(onScene: boolean): void {
    this.STATUS_MOUSE_ON_SCENE = onScene
  }

  isActive(): boolean {
    return (
      this.STATUS_MOUSE_ON_NODE ||
      this.STATUS_MOUSE_ON_SCENE ||
      this.isRecording() ||
      !this.INITIAL_RENDER_DONE
    )
  }

  async exportModel(format: string): Promise<void> {
    if (!this.modelManager.currentModel) {
      throw new Error('No model to export')
    }

    const exportMessage = `Exporting as ${format.toUpperCase()}...`
    this.eventManager.emitEvent('exportLoadingStart', exportMessage)

    try {
      const model = this.modelManager.currentModel.clone()

      const originalFileName = this.modelManager.originalFileName || 'model'
      const filename = `${originalFileName}.${format}`

      const originalURL = this.modelManager.originalURL

      await new Promise((resolve) => setTimeout(resolve, 10))

      switch (format) {
        case 'glb':
          await ModelExporter.exportGLB(model, filename, originalURL)
          break
        case 'obj':
          await ModelExporter.exportOBJ(model, filename, originalURL)
          break
        case 'stl':
          await ModelExporter.exportSTL(model, filename), originalURL
          break
        default:
          throw new Error(`Unsupported export format: ${format}`)
      }

      await new Promise((resolve) => setTimeout(resolve, 10))
    } catch (error) {
      console.error(`Error exporting model as ${format}:`, error)
      throw error
    } finally {
      this.eventManager.emitEvent('exportLoadingEnd', null)
    }
  }

  async applyTexture(texturePath: string): Promise<void> {
    if (!this.modelManager.currentModel) {
      throw new Error('No model to apply texture to')
    }

    this.eventManager.emitEvent('textureLoadingStart', null)

    try {
      await this.modelManager.applyTexture(texturePath)
    } catch (error) {
      console.error('Error applying texture:', error)
      throw error
    } finally {
      this.eventManager.emitEvent('textureLoadingEnd', null)
    }
  }

  setBackgroundColor(color: string): void {
    this.sceneManager.setBackgroundColor(color)
    this.forceRender()
  }

  async setBackgroundImage(uploadPath: string): Promise<void> {
    await this.sceneManager.setBackgroundImage(uploadPath)

    if (this.previewManager.previewRenderer) {
      this.previewManager.updateBackgroundTexture(
        this.sceneManager.backgroundTexture
      )
    }

    this.forceRender()
  }

  removeBackgroundImage(): void {
    this.sceneManager.removeBackgroundImage()

    if (
      this.previewManager.previewRenderer &&
      this.previewManager.previewCamera
    ) {
      this.previewManager.updateBackgroundTexture(null)
    }

    this.forceRender()
  }

  toggleGrid(showGrid: boolean): void {
    this.sceneManager.toggleGrid(showGrid)
    this.forceRender()
  }

  toggleCamera(cameraType?: 'perspective' | 'orthographic'): void {
    this.cameraManager.toggleCamera(cameraType)

    this.controlsManager.updateCamera(this.cameraManager.activeCamera)
    this.viewHelperManager.recreateViewHelper()

    this.handleResize()
    this.forceRender()
  }

  getCurrentCameraType(): 'perspective' | 'orthographic' {
    return this.cameraManager.getCurrentCameraType()
  }

  setCameraState(state: CameraState): void {
    this.cameraManager.setCameraState(state)

    if (this.previewManager.showPreview) {
      this.previewManager.syncWithMainCamera()
    }

    this.forceRender()
  }

  getCameraState(): CameraState {
    return this.cameraManager.getCameraState()
  }

  setFOV(fov: number): void {
    this.cameraManager.setFOV(fov)
    this.forceRender()
  }

  setEdgeThreshold(threshold: number): void {
    this.modelManager.setEdgeThreshold(threshold)
    this.forceRender()
  }

  setMaterialMode(mode: MaterialMode): void {
    this.modelManager.setMaterialMode(mode)
    this.forceRender()
  }

  async loadModel(url: string, originalFileName?: string): Promise<void> {
    this.cameraManager.reset()
    this.controlsManager.reset()
    this.modelManager.reset()

    await this.loaderManager.loadModel(url, originalFileName)

    this.handleResize()
    this.forceRender()
  }

  clearModel(): void {
    this.modelManager.clearModel()
    this.forceRender()
  }

  setUpDirection(direction: UpDirection): void {
    this.modelManager.setUpDirection(direction)
    this.forceRender()
  }

  setLightIntensity(intensity: number): void {
    this.lightingManager.setLightIntensity(intensity)
    this.forceRender()
  }

  togglePreview(showPreview: boolean): void {
    this.previewManager.togglePreview(showPreview)
    this.forceRender()
  }

  setTargetSize(width: number, height: number): void {
    this.previewManager.setTargetSize(width, height)
    this.forceRender()
  }

  addEventListener(event: string, callback: (data?: any) => void): void {
    this.eventManager.addEventListener(event, callback)
  }

  removeEventListener(event: string, callback: (data?: any) => void): void {
    this.eventManager.removeEventListener(event, callback)
  }

  refreshViewport(): void {
    this.handleResize()
    this.forceRender()
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
    this.forceRender()
  }

  captureScene(width: number, height: number): Promise<CaptureResult> {
    return this.sceneManager.captureScene(width, height)
  }

  loadNodeProperty(name: string, defaultValue: any) {
    return this.nodeStorage.loadNodeProperty(name, defaultValue)
  }

  public async startRecording(): Promise<void> {
    this.viewHelperManager.visibleViewHelper(false)

    return this.recordingManager.startRecording()
  }

  public stopRecording(): void {
    this.viewHelperManager.visibleViewHelper(true)

    this.recordingManager.stopRecording()

    this.eventManager.emitEvent('recordingStatusChange', false)
  }

  public isRecording(): boolean {
    return this.recordingManager.getIsRecording()
  }

  public getRecordingDuration(): number {
    return this.recordingManager.getRecordingDuration()
  }

  public getRecordingData(): string | null {
    return this.recordingManager.getRecordingData()
  }

  public exportRecording(filename?: string): void {
    this.recordingManager.exportRecording(filename)
  }

  public clearRecording(): void {
    this.recordingManager.clearRecording()
  }

  public remove(): void {
    this.renderer.forceContextLoss()
    const canvas = this.renderer.domElement
    const event = new Event('webglcontextlost', {
      bubbles: true,
      cancelable: true
    })
    canvas.dispatchEvent(event)

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
    this.recordingManager.dispose()

    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}

export default Load3d
