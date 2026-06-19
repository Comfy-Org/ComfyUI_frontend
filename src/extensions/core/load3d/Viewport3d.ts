import * as THREE from 'three'

import type { CameraManager } from './CameraManager'
import type { ControlsManager } from './ControlsManager'
import type { EventManager } from './EventManager'
import type { LightingManager } from './LightingManager'
import type { SceneManager } from './SceneManager'
import type { ViewHelperManager } from './ViewHelperManager'
import type {
  CameraState,
  EventCallback,
  Load3DOptions,
  SceneOverlay
} from './interfaces'
import { attachContextMenuGuard } from './load3dContextMenuGuard'
import type { RenderLoopHandle } from './load3dRenderLoop'
import { startRenderLoop } from './load3dRenderLoop'
import { computeLetterboxedViewport, isLoad3dActive } from './load3dViewport'

export type Viewport3dDeps = {
  renderer: THREE.WebGLRenderer
  eventManager: EventManager
  sceneManager: SceneManager
  cameraManager: CameraManager
  controlsManager: ControlsManager
  lightingManager: LightingManager
  viewHelperManager: ViewHelperManager
}

export class Viewport3d {
  renderer: THREE.WebGLRenderer
  protected clock: THREE.Clock
  private renderLoop: RenderLoopHandle | null = null
  private onContextMenuCallback?: (event: MouseEvent) => void
  private getDimensionsCallback?: () => { width: number; height: number } | null

  eventManager: EventManager
  sceneManager: SceneManager
  cameraManager: CameraManager
  controlsManager: ControlsManager
  lightingManager: LightingManager
  viewHelperManager: ViewHelperManager

  STATUS_MOUSE_ON_NODE: boolean
  STATUS_MOUSE_ON_SCENE: boolean
  STATUS_MOUSE_ON_VIEWER: boolean
  INITIAL_RENDER_DONE: boolean = false

  targetWidth: number = 0
  targetHeight: number = 0
  targetAspectRatio: number = 1
  isViewerMode: boolean = false

  private disposeContextMenuGuard: (() => void) | null = null
  private resizeObserver: ResizeObserver | null = null
  private getZoomScaleCallback: (() => number) | undefined
  private externalActiveCamera: THREE.Camera | null = null
  private overlay: SceneOverlay | null = null

  constructor(
    container: Element | HTMLElement,
    deps: Viewport3dDeps,
    options: Load3DOptions = {}
  ) {
    this.clock = new THREE.Clock()
    this.isViewerMode = options.isViewerMode || false
    this.onContextMenuCallback = options.onContextMenu
    this.getDimensionsCallback = options.getDimensions
    this.getZoomScaleCallback = options.getZoomScale

    if (options.width && options.height) {
      this.targetWidth = options.width
      this.targetHeight = options.height
      this.targetAspectRatio = options.width / options.height
    }

    this.renderer = deps.renderer
    this.eventManager = deps.eventManager
    this.sceneManager = deps.sceneManager
    this.cameraManager = deps.cameraManager
    this.controlsManager = deps.controlsManager
    this.lightingManager = deps.lightingManager
    this.viewHelperManager = deps.viewHelperManager

    this.sceneManager.init()
    this.cameraManager.init()
    this.controlsManager.init()
    this.lightingManager.init()

    this.viewHelperManager.createViewHelper(container)
    this.viewHelperManager.init()

    this.STATUS_MOUSE_ON_NODE = false
    this.STATUS_MOUSE_ON_SCENE = false
    this.STATUS_MOUSE_ON_VIEWER = false

    this.initContextMenu()
    this.initResizeObserver(container)
  }

  start(): void {
    if (this.hasStarted) return
    this.hasStarted = true
    this.handleResize()
    this.startAnimation()
    setTimeout(() => {
      this.forceRender()
    }, 100)
  }

  private hasStarted: boolean = false

  private initResizeObserver(container: Element | HTMLElement): void {
    if (typeof ResizeObserver === 'undefined') return

    this.resizeObserver?.disconnect()
    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize()
    })
    this.resizeObserver.observe(container)
  }

  private initContextMenu(): void {
    this.disposeContextMenuGuard = attachContextMenuGuard(
      this.renderer.domElement,
      (event) => this.onContextMenuCallback?.(event),
      { isDisabled: () => this.isViewerMode }
    )
  }

  getEventManager(): EventManager {
    return this.eventManager
  }
  getSceneManager(): SceneManager {
    return this.sceneManager
  }
  getCameraManager(): CameraManager {
    return this.cameraManager
  }
  getControlsManager(): ControlsManager {
    return this.controlsManager
  }
  getLightingManager(): LightingManager {
    return this.lightingManager
  }
  getViewHelperManager(): ViewHelperManager {
    return this.viewHelperManager
  }

  getTargetSize(): { width: number; height: number } {
    return {
      width: this.targetWidth,
      height: this.targetHeight
    }
  }

  protected shouldMaintainAspectRatio(): boolean {
    return this.isViewerMode || (this.targetWidth > 0 && this.targetHeight > 0)
  }

  forceRender(): void {
    const delta = this.clock.getDelta()
    this.tickPerFrame(delta)

    this.renderMainScene()
    this.resetViewport()

    if (this.viewHelperManager.viewHelper.render) {
      this.viewHelperManager.viewHelper.render(this.renderer)
    }

    this.INITIAL_RENDER_DONE = true
  }

  protected tickPerFrame(delta: number): void {
    this.overlay?.update?.(delta)
    this.viewHelperManager.update(delta)
    this.controlsManager.update()
  }

  getRenderCamera(): THREE.Camera {
    return this.externalActiveCamera ?? this.cameraManager.activeCamera
  }

  setExternalActiveCamera(camera: THREE.Camera | null): void {
    if (this.externalActiveCamera === camera) return
    this.externalActiveCamera = camera
    if (camera) {
      this.controlsManager.detach()
      this.viewHelperManager.visibleViewHelper(false)
    } else {
      this.controlsManager.attach()
      this.viewHelperManager.visibleViewHelper(true)
    }
    this.overlay?.onActiveCameraChange?.(this.getRenderCamera())
    this.forceRender()
  }

  setOverlay(overlay: SceneOverlay): void {
    if (this.overlay === overlay) return
    if (this.overlay) {
      this.overlay.detach()
      this.overlay.dispose()
    }
    this.overlay = overlay
    overlay.attach(this.sceneManager.scene)
    overlay.onActiveCameraChange?.(this.getRenderCamera())
    this.forceRender()
  }

  removeOverlay(): void {
    if (!this.overlay) return
    this.overlay.detach()
    this.overlay.dispose()
    this.overlay = null
    this.forceRender()
  }

  getOverlay(): SceneOverlay | null {
    return this.overlay
  }

  renderMainScene(): void {
    const containerWidth = this.renderer.domElement.clientWidth
    const containerHeight = this.renderer.domElement.clientHeight

    if (this.getDimensionsCallback) {
      const dims = this.getDimensionsCallback()
      if (dims) {
        this.targetWidth = dims.width
        this.targetHeight = dims.height
        this.targetAspectRatio = dims.width / dims.height
      }
    }

    if (this.shouldMaintainAspectRatio()) {
      const { offsetX, offsetY, width, height } = computeLetterboxedViewport(
        { width: containerWidth, height: containerHeight },
        this.targetAspectRatio
      )

      this.renderer.setViewport(0, 0, containerWidth, containerHeight)
      this.renderer.setScissor(0, 0, containerWidth, containerHeight)
      this.renderer.setScissorTest(true)
      this.renderer.setClearColor(0x0a0a0a)
      this.renderer.clear()

      this.renderer.setViewport(offsetX, offsetY, width, height)
      this.renderer.setScissor(offsetX, offsetY, width, height)

      this.cameraManager.updateAspectRatio(width / height)
    } else {
      this.renderer.setViewport(0, 0, containerWidth, containerHeight)
      this.renderer.setScissor(0, 0, containerWidth, containerHeight)
      this.renderer.setScissorTest(true)
    }

    this.sceneManager.renderBackground()
    this.renderer.render(this.sceneManager.scene, this.getRenderCamera())
  }

  resetViewport(): void {
    const width = this.renderer.domElement.clientWidth
    const height = this.renderer.domElement.clientHeight

    this.renderer.setViewport(0, 0, width, height)
    this.renderer.setScissor(0, 0, width, height)
    this.renderer.setScissorTest(false)
  }

  protected startAnimation(): void {
    this.renderLoop = startRenderLoop({
      tick: () => {
        const delta = this.clock.getDelta()
        this.tickPerFrame(delta)
        this.renderMainScene()
        this.resetViewport()
        if (this.viewHelperManager.viewHelper.render) {
          this.viewHelperManager.viewHelper.render(this.renderer)
        }
      },
      isActive: () => this.isActive()
    })
  }

  updateStatusMouseOnNode(onNode: boolean): void {
    this.STATUS_MOUSE_ON_NODE = onNode
  }

  updateStatusMouseOnScene(onScene: boolean): void {
    this.STATUS_MOUSE_ON_SCENE = onScene
  }

  updateStatusMouseOnViewer(onViewer: boolean): void {
    this.STATUS_MOUSE_ON_VIEWER = onViewer
  }

  isActive(): boolean {
    return isLoad3dActive({
      mouseOnNode: this.STATUS_MOUSE_ON_NODE,
      mouseOnScene: this.STATUS_MOUSE_ON_SCENE,
      mouseOnViewer: this.STATUS_MOUSE_ON_VIEWER,
      recording: false,
      initialRenderDone: this.INITIAL_RENDER_DONE,
      animationPlaying: false
    })
  }

  toggleCamera(cameraType?: 'perspective' | 'orthographic'): void {
    this.cameraManager.toggleCamera(cameraType)
    this.controlsManager.updateCamera(this.cameraManager.activeCamera)
    this.viewHelperManager.recreateViewHelper()
    if (!this.externalActiveCamera) {
      this.overlay?.onActiveCameraChange?.(this.cameraManager.activeCamera)
    }
    this.handleResize()
  }

  getCurrentCameraType(): 'perspective' | 'orthographic' {
    return this.cameraManager.getCurrentCameraType()
  }

  setCameraState(state: CameraState): void {
    this.cameraManager.setCameraState(state)
    this.forceRender()
  }

  getCameraState(): CameraState {
    return this.cameraManager.getCameraState()
  }

  setTargetSize(width: number, height: number): void {
    this.targetWidth = width
    this.targetHeight = height
    this.targetAspectRatio = width / height
    this.handleResize()
  }

  addEventListener<T>(event: string, callback: EventCallback<T>): void {
    this.eventManager.addEventListener(event, callback)
  }

  removeEventListener<T>(event: string, callback: EventCallback<T>): void {
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

    const containerWidth = parentElement.clientWidth
    const containerHeight = parentElement.clientHeight

    const zoomScale = this.getZoomScaleCallback?.() ?? 1
    this.renderer.setPixelRatio(Math.min(zoomScale, 3))

    if (this.getDimensionsCallback) {
      const dims = this.getDimensionsCallback()
      if (dims) {
        this.targetWidth = dims.width
        this.targetHeight = dims.height
        this.targetAspectRatio = dims.width / dims.height
      }
    }

    if (this.shouldMaintainAspectRatio()) {
      const { width, height } = computeLetterboxedViewport(
        { width: containerWidth, height: containerHeight },
        this.targetAspectRatio
      )

      this.renderer.setSize(containerWidth, containerHeight)
      this.cameraManager.handleResize(width, height)
      this.sceneManager.handleResize(width, height)
    } else {
      this.renderer.setSize(containerWidth, containerHeight)
      this.cameraManager.handleResize(containerWidth, containerHeight)
      this.sceneManager.handleResize(containerWidth, containerHeight)
    }

    this.forceRender()
  }

  remove(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }

    this.disposeContextMenuGuard?.()
    this.disposeContextMenuGuard = null

    this.renderer.forceContextLoss()
    const canvas = this.renderer.domElement
    const event = new Event('webglcontextlost', {
      bubbles: true,
      cancelable: true
    })
    canvas.dispatchEvent(event)

    this.renderLoop?.stop()
    this.renderLoop = null

    this.disposeManagers()

    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  protected disposeManagers(): void {
    if (this.overlay) {
      this.overlay.detach()
      this.overlay.dispose()
      this.overlay = null
    }
    this.sceneManager.dispose()
    this.cameraManager.dispose()
    this.controlsManager.dispose()
    this.lightingManager.dispose()
    this.viewHelperManager.dispose()
  }
}
