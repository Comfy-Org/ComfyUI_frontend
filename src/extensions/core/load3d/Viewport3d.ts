import * as THREE from 'three'

import type { RendererView } from '@/renderer/three/RendererView'

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

const VIEW_HELPER_SIZE = 128

export type Viewport3dDeps = {
  view: RendererView
  eventManager: EventManager
  sceneManager: SceneManager
  cameraManager: CameraManager
  controlsManager: ControlsManager
  lightingManager: LightingManager
  viewHelperManager: ViewHelperManager
}

export class Viewport3d {
  protected readonly view: RendererView
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
  private getZoomScaleCallback: (() => number) | undefined
  private externalActiveCamera: THREE.Camera | null = null
  private overlay: SceneOverlay | null = null
  private initialRenderTimer: ReturnType<typeof setTimeout> | null = null
  private viewPixelScale = 1

  constructor(
    container: HTMLElement,
    deps: Viewport3dDeps,
    options: Load3DOptions = {}
  ) {
    this.view = deps.view
    this.clock = new THREE.Clock()
    this.isViewerMode = options.isViewerMode || false
    this.onContextMenuCallback = options.onContextMenu
    this.getDimensionsCallback = options.getDimensions
    this.getZoomScaleCallback = options.getZoomScale

    if (options.width !== undefined && options.height !== undefined) {
      this.applyTargetSize(options.width, options.height)
    }

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
    this.view.observeResize(container, () => this.handleResize())
  }

  get renderer(): THREE.WebGLRenderer {
    return this.view.renderer
  }

  get domElement(): HTMLCanvasElement {
    return this.view.canvas
  }

  start(): void {
    if (this.hasStarted) return
    this.hasStarted = true
    this.handleResize()
    this.startAnimation()
    this.initialRenderTimer = setTimeout(() => {
      this.initialRenderTimer = null
      this.forceRender()
    }, 100)
  }

  private hasStarted: boolean = false

  private applyTargetSize(width: number, height: number): void {
    if (!Number.isFinite(width) || !Number.isFinite(height)) return
    if (width <= 0 || height <= 0) return
    this.targetWidth = width
    this.targetHeight = height
    this.targetAspectRatio = width / height
  }

  private initContextMenu(): void {
    this.disposeContextMenuGuard = attachContextMenuGuard(
      this.view.canvas,
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
    this.renderView()
    this.INITIAL_RENDER_DONE = true
  }

  private renderView(): void {
    this.view.beginRender()
    this.renderMainScene()

    this.renderer.setScissorTest(false)
    this.viewHelperManager.render(
      this.renderer,
      VIEW_HELPER_SIZE * this.viewPixelScale
    )

    this.view.blit()
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
    const viewWidth = this.view.width
    const viewHeight = this.view.height

    if (this.getDimensionsCallback) {
      const dims = this.getDimensionsCallback()
      if (dims) {
        this.applyTargetSize(dims.width, dims.height)
      }
    }

    this.renderer.setViewport(0, 0, viewWidth, viewHeight)
    this.renderer.setScissor(0, 0, viewWidth, viewHeight)
    this.renderer.setScissorTest(true)

    if (this.shouldMaintainAspectRatio()) {
      const { offsetX, offsetY, width, height } = computeLetterboxedViewport(
        { width: viewWidth, height: viewHeight },
        this.targetAspectRatio
      )

      this.renderer.setClearColor(0x0a0a0a)
      this.renderer.clear()

      this.renderer.setViewport(offsetX, offsetY, width, height)
      this.renderer.setScissor(offsetX, offsetY, width, height)

      this.cameraManager.updateAspectRatio(width / height)
    } else {
      this.renderer.setClearColor(
        this.view.state.clearColor,
        this.view.state.clearAlpha
      )
      this.renderer.clear()
    }

    this.sceneManager.renderBackground()
    this.renderer.render(this.sceneManager.scene, this.getRenderCamera())
  }

  protected startAnimation(): void {
    this.renderLoop = startRenderLoop({
      tick: () => {
        const delta = this.clock.getDelta()
        this.tickPerFrame(delta)
        this.renderView()
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
    this.onActiveCameraChanged()
    this.viewHelperManager.recreateViewHelper()
    if (!this.externalActiveCamera) {
      this.overlay?.onActiveCameraChange?.(this.cameraManager.activeCamera)
    }
    this.handleResize()
  }

  protected onActiveCameraChanged(): void {}

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
    this.applyTargetSize(width, height)
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
    const parentElement = this.view.canvas.parentElement

    if (!parentElement) {
      console.warn('Parent element not found')
      return
    }

    const containerWidth = parentElement.clientWidth
    const containerHeight = parentElement.clientHeight

    const zoomScale = this.getZoomScaleCallback?.() ?? 1
    this.viewPixelScale = Math.min(zoomScale, 3)

    if (this.getDimensionsCallback) {
      const dims = this.getDimensionsCallback()
      if (dims) {
        this.applyTargetSize(dims.width, dims.height)
      }
    }

    this.view.setSize(
      containerWidth * this.viewPixelScale,
      containerHeight * this.viewPixelScale
    )

    if (this.shouldMaintainAspectRatio()) {
      const { width, height } = computeLetterboxedViewport(
        { width: containerWidth, height: containerHeight },
        this.targetAspectRatio
      )

      this.cameraManager.handleResize(width, height)
      this.sceneManager.handleResize(width, height)
    } else {
      this.cameraManager.handleResize(containerWidth, containerHeight)
      this.sceneManager.handleResize(containerWidth, containerHeight)
    }

    this.forceRender()
  }

  remove(): void {
    if (this.initialRenderTimer) {
      clearTimeout(this.initialRenderTimer)
      this.initialRenderTimer = null
    }

    this.disposeContextMenuGuard?.()
    this.disposeContextMenuGuard = null

    this.renderLoop?.stop()
    this.renderLoop = null

    this.disposeManagers()

    this.view.dispose()
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
