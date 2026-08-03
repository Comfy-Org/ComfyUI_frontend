import * as THREE from 'three'

import type { RendererView } from '@/renderer/three/RendererView'
import { normalize } from '@/utils/mathUtil'

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
import type {
  LetterboxedViewport,
  LetterboxNdc,
  ViewportRect
} from './load3dViewport'
import {
  clientPointToLetterboxNdc,
  computeLetterboxBars,
  computeLetterboxedViewport,
  isLoad3dActive
} from './load3dViewport'

const LETTERBOX_CLEAR_COLOR = 0x0a0a0a
const LETTERBOX_DIM_OPACITY = 0.5

type LetterboxDimmer = {
  scene: THREE.Scene
  camera: THREE.OrthographicCamera
  geometry: THREE.PlaneGeometry
  material: THREE.MeshBasicMaterial
}

function supportsViewOffset(
  camera: THREE.Camera
): camera is THREE.PerspectiveCamera | THREE.OrthographicCamera {
  return (
    camera instanceof THREE.PerspectiveCamera ||
    camera instanceof THREE.OrthographicCamera
  )
}

function createLetterboxDimmer(): LetterboxDimmer {
  const geometry = new THREE.PlaneGeometry(2, 2)
  const material = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: LETTERBOX_DIM_OPACITY,
    depthTest: false,
    depthWrite: false
  })
  const scene = new THREE.Scene()
  scene.add(new THREE.Mesh(geometry, material))
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1)
  return { scene, camera, geometry, material }
}

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
  protected timer: THREE.Timer
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
  private letterboxDimmer: LetterboxDimmer | null = null

  constructor(
    container: HTMLElement,
    deps: Viewport3dDeps,
    options: Load3DOptions = {}
  ) {
    this.view = deps.view
    this.timer = new THREE.Timer()
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
    const delta = this.timer.update().getDelta()
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

    if (!this.shouldMaintainAspectRatio()) {
      this.renderer.setClearColor(
        this.view.state.clearColor,
        this.view.state.clearAlpha
      )
      this.renderer.clear()
      this.sceneManager.renderBackground()
      this.renderer.render(this.sceneManager.scene, this.getRenderCamera())
      return
    }

    const container = { width: viewWidth, height: viewHeight }
    const viewport = computeLetterboxedViewport(
      container,
      this.targetAspectRatio
    )

    this.renderer.setClearColor(LETTERBOX_CLEAR_COLOR)
    this.renderer.clear()

    this.cameraManager.updateAspectRatio(viewport.width / viewport.height)

    const camera = this.getRenderCamera()

    if (!supportsViewOffset(camera)) {
      this.renderer.setViewport(
        viewport.offsetX,
        viewport.offsetY,
        viewport.width,
        viewport.height
      )
      this.renderer.setScissor(
        viewport.offsetX,
        viewport.offsetY,
        viewport.width,
        viewport.height
      )
      this.sceneManager.renderBackground()
      this.renderer.render(this.sceneManager.scene, camera)
      return
    }

    camera.setViewOffset(
      viewport.width,
      viewport.height,
      -viewport.offsetX,
      -viewport.offsetY,
      viewWidth,
      viewHeight
    )

    this.renderLetterboxedBackground(viewport)
    this.renderer.render(this.sceneManager.scene, camera)
    camera.clearViewOffset()

    this.dimLetterboxBars(computeLetterboxBars(container, viewport))
  }

  private renderLetterboxedBackground(viewport: LetterboxedViewport): void {
    if (this.sceneManager.getCurrentBackgroundInfo().type !== 'image') {
      this.sceneManager.renderBackground()
      return
    }

    this.renderer.setViewport(
      viewport.offsetX,
      viewport.offsetY,
      viewport.width,
      viewport.height
    )
    this.renderer.setScissor(
      viewport.offsetX,
      viewport.offsetY,
      viewport.width,
      viewport.height
    )
    this.sceneManager.renderBackground()
    this.renderer.setViewport(0, 0, this.view.width, this.view.height)
    this.renderer.setScissor(0, 0, this.view.width, this.view.height)
  }

  private dimLetterboxBars(bars: ViewportRect[]): void {
    if (bars.length === 0) return

    const dimmer = (this.letterboxDimmer ??= createLetterboxDimmer())
    for (const bar of bars) {
      this.renderer.setViewport(bar.x, bar.y, bar.width, bar.height)
      this.renderer.setScissor(bar.x, bar.y, bar.width, bar.height)
      this.renderer.render(dimmer.scene, dimmer.camera)
    }
  }

  clientPointToNdc(clientX: number, clientY: number): LetterboxNdc | null {
    const rect = this.domElement.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null
    return clientPointToLetterboxNdc(
      normalize(clientX, rect.left, rect.right),
      normalize(clientY, rect.top, rect.bottom),
      { width: rect.width, height: rect.height },
      this.shouldMaintainAspectRatio() ? this.targetAspectRatio : null
    )
  }

  protected startAnimation(): void {
    this.renderLoop = startRenderLoop({
      tick: () => {
        const delta = this.timer.update().getDelta()
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
    if (this.letterboxDimmer) {
      this.letterboxDimmer.geometry.dispose()
      this.letterboxDimmer.material.dispose()
      this.letterboxDimmer = null
    }
    this.sceneManager.dispose()
    this.cameraManager.dispose()
    this.controlsManager.dispose()
    this.lightingManager.dispose()
    this.viewHelperManager.dispose()
  }
}
