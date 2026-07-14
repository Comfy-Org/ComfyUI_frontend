import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'

import type { AnimationManager } from './AnimationManager'
import type { GizmoManager } from './GizmoManager'
import type { HDRIManager } from './HDRIManager'
import type { LoaderManager } from './LoaderManager'
import { ModelExporter } from './ModelExporter'
import { DEFAULT_MODEL_CAPABILITIES } from './ModelAdapter'
import type { AdapterRef, ModelAdapterCapabilities } from './ModelAdapter'
import type { RecordingManager } from './RecordingManager'
import type { SceneModelManager } from './SceneModelManager'
import { Viewport3d, type Viewport3dDeps } from './Viewport3d'
import { computeCameraFromMatrices } from './cameraFromMatrices'
import { DIRECT_EXPORT_FORMATS } from './constants'
import type {
  CaptureResult,
  GizmoMode,
  Load3DOptions,
  LoadModelOptions,
  MaterialMode,
  Model3DTransform,
  UpDirection
} from './interfaces'
import { computeLetterboxedViewport, isLoad3dActive } from './load3dViewport'

export type Load3dDeps = Viewport3dDeps & {
  hdriManager: HDRIManager
  loaderManager: LoaderManager
  modelManager: SceneModelManager
  recordingManager: RecordingManager
  animationManager: AnimationManager
  gizmoManager: GizmoManager
  adapterRef: AdapterRef
}

function positionThumbnailCamera(
  camera: THREE.PerspectiveCamera,
  model: THREE.Object3D
) {
  const box = new THREE.Box3().setFromObject(model)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z)
  const distance = maxDim * 1.5

  camera.position.set(
    center.x + distance * 0.7,
    center.y + distance * 0.5,
    center.z + distance * 0.7
  )
  camera.lookAt(center)
  camera.updateProjectionMatrix()
}

class Load3d extends Viewport3d {
  hdriManager: HDRIManager
  loaderManager: LoaderManager
  modelManager: SceneModelManager
  recordingManager: RecordingManager
  animationManager: AnimationManager
  gizmoManager: GizmoManager
  adapterRef: AdapterRef

  private loadingPromise: Promise<void> | null = null
  private _loadGeneration: number = 0
  private hasLoadedModel: boolean = false

  constructor(
    container: HTMLElement,
    deps: Load3dDeps,
    options: Load3DOptions = {}
  ) {
    super(container, deps, options)

    this.hdriManager = deps.hdriManager
    this.loaderManager = deps.loaderManager
    this.modelManager = deps.modelManager
    this.recordingManager = deps.recordingManager
    this.animationManager = deps.animationManager
    this.gizmoManager = deps.gizmoManager
    this.adapterRef = deps.adapterRef

    this.loaderManager.init()
    this.animationManager.init()
    this.gizmoManager.setPointerNdcSource((clientX, clientY) =>
      this.clientPointToNdc(clientX, clientY)
    )
    this.gizmoManager.init()

    this.eventManager.addEventListener('modelReady', () => {
      if (this.adapterRef.current?.kind !== 'splat') return
      void this.repaintWhenSparkPaintable()
    })

    this.start()
  }

  private async repaintWhenSparkPaintable(): Promise<void> {
    const sortComplete = this.sceneManager.awaitNextSparkDirty()
    this.forceRender()
    await sortComplete
    this.forceRender()
  }

  getLoaderManager(): LoaderManager {
    return this.loaderManager
  }

  getModelManager(): SceneModelManager {
    return this.modelManager
  }

  getRecordingManager(): RecordingManager {
    return this.recordingManager
  }

  getGizmoManager(): GizmoManager {
    return this.gizmoManager
  }

  protected override tickPerFrame(delta: number): void {
    this.animationManager.update(delta)
    super.tickPerFrame(delta)
  }

  override isActive(): boolean {
    return isLoad3dActive({
      mouseOnNode: this.STATUS_MOUSE_ON_NODE,
      mouseOnScene: this.STATUS_MOUSE_ON_SCENE,
      mouseOnViewer: this.STATUS_MOUSE_ON_VIEWER,
      recording: this.isRecording(),
      initialRenderDone: this.INITIAL_RENDER_DONE,
      animationPlaying: this.animationManager.isAnimationPlaying
    })
  }

  async exportModel(format: string): Promise<void> {
    if (!this.modelManager.currentModel) {
      throw new Error('No model to export')
    }

    const exportMessage = `Exporting as ${format.toUpperCase()}...`
    this.eventManager.emitEvent('exportLoadingStart', exportMessage)

    const originalFileName = this.modelManager.originalFileName || 'model'
    const filename = `${originalFileName}.${format}`
    const originalURL = this.modelManager.originalURL

    if (DIRECT_EXPORT_FORMATS.has(format)) {
      try {
        if (this.getSourceFormat() !== format) {
          throw new Error(
            `Cannot export ${format} without converting from the loaded ${this.getSourceFormat() ?? 'unknown'} source`
          )
        }
        await ModelExporter.exportDirect(originalURL, filename, format)
      } catch (error) {
        console.error(`Error exporting model as ${format}:`, error)
        throw error
      } finally {
        this.eventManager.emitEvent('exportLoadingEnd', null)
      }
      return
    }

    const source = this.modelManager.currentModel
    const savedPos = source.position.clone()
    const savedRot = source.rotation.clone()
    const savedScale = source.scale.clone()
    source.position.set(0, 0, 0)
    source.rotation.set(0, 0, 0)
    source.scale.set(1, 1, 1)
    source.updateMatrixWorld(true)

    try {
      const original = this.modelManager.originalModel
      const clipsFromOriginal =
        original &&
        'animations' in original &&
        Array.isArray(original.animations)
          ? original.animations
          : []
      const clips = source.animations?.length
        ? source.animations
        : clipsFromOriginal
      const model =
        format === 'fbx'
          ? Object.assign(cloneSkinned(source), { animations: clips })
          : source.clone()

      await new Promise((resolve) => setTimeout(resolve, 10))

      switch (format) {
        case 'glb':
          await ModelExporter.exportGLB(model, filename, originalURL)
          break
        case 'obj':
          await ModelExporter.exportOBJ(model, filename, originalURL)
          break
        case 'stl':
          await ModelExporter.exportSTL(model, filename, originalURL)
          break
        case 'fbx':
          await ModelExporter.exportFBX(model, filename, originalURL)
          break
        default:
          throw new Error(`Unsupported export format: ${format}`)
      }

      await new Promise((resolve) => setTimeout(resolve, 10))
    } catch (error) {
      console.error(`Error exporting model as ${format}:`, error)
      throw error
    } finally {
      source.position.copy(savedPos)
      source.rotation.copy(savedRot)
      source.scale.copy(savedScale)
      source.updateMatrixWorld(true)
      this.eventManager.emitEvent('exportLoadingEnd', null)
    }
  }

  getSourceFormat(): string | null {
    const url = this.modelManager.originalURL
    if (!url) return null
    return ModelExporter.detectFormatFromURL(url)
  }

  protected override onActiveCameraChanged(): void {
    this.gizmoManager.updateCamera(this.cameraManager.activeCamera)
  }

  setFOV(fov: number): void {
    this.cameraManager.setFOV(fov)
    this.forceRender()
  }

  setBackgroundColor(color: string): void {
    this.sceneManager.setBackgroundColor(color)
    this.forceRender()
  }

  toggleGrid(showGrid: boolean): void {
    this.sceneManager.toggleGrid(showGrid)
    this.forceRender()
  }

  setLightIntensity(intensity: number): void {
    this.lightingManager.setLightIntensity(intensity)
    this.forceRender()
  }

  async setBackgroundImage(uploadPath: string): Promise<void> {
    await this.sceneManager.setBackgroundImage(uploadPath)

    if (
      this.sceneManager.backgroundTexture &&
      this.sceneManager.backgroundMesh
    ) {
      const containerWidth = this.domElement.clientWidth
      const containerHeight = this.domElement.clientHeight

      if (this.shouldMaintainAspectRatio()) {
        const { width, height } = computeLetterboxedViewport(
          { width: containerWidth, height: containerHeight },
          this.targetAspectRatio
        )

        this.sceneManager.updateBackgroundSize(
          this.sceneManager.backgroundTexture,
          this.sceneManager.backgroundMesh,
          width,
          height
        )
      } else {
        this.sceneManager.updateBackgroundSize(
          this.sceneManager.backgroundTexture,
          this.sceneManager.backgroundMesh,
          containerWidth,
          containerHeight
        )
      }
    }

    this.forceRender()
  }

  removeBackgroundImage(): void {
    this.sceneManager.removeBackgroundImage()
    this.forceRender()
  }

  setBackgroundRenderMode(mode: 'tiled' | 'panorama'): void {
    this.sceneManager.setBackgroundRenderMode(mode)
    this.forceRender()
  }

  setCameraFromMatrices(
    extrinsics: readonly (readonly number[])[],
    intrinsics: readonly (readonly number[])[]
  ): void {
    const { position, target, fovYDegrees } = computeCameraFromMatrices(
      extrinsics,
      intrinsics
    )
    const current = this.cameraManager.getCameraState()
    this.setCameraState({
      position: new THREE.Vector3(position[0], position[1], position[2]),
      target: new THREE.Vector3(target[0], target[1], target[2]),
      zoom: current.zoom,
      cameraType: current.cameraType
    })
    this.setFOV(fovYDegrees)
  }

  getCurrentModel(): THREE.Object3D | null {
    return this.modelManager.currentModel
  }

  setMaterialMode(mode: MaterialMode): void {
    this.modelManager.setMaterialMode(mode)
    this.forceRender()
  }

  get currentLoadGeneration(): number {
    return this._loadGeneration
  }

  async loadModel(
    url: string,
    originalFileName?: string,
    options?: LoadModelOptions
  ): Promise<void> {
    this._loadGeneration += 1

    if (this.loadingPromise) {
      try {
        await this.loadingPromise
      } catch (e) {}
    }

    this.loadingPromise = this._loadModelInternal(
      url,
      originalFileName,
      options
    )
    return this.loadingPromise
  }

  async whenLoadIdle(): Promise<void> {
    let last: Promise<void> | null = null
    while (this.loadingPromise && this.loadingPromise !== last) {
      last = this.loadingPromise
      try {
        await last
      } catch (e) {}
    }
  }

  private async _loadModelInternal(
    url: string,
    originalFileName?: string,
    options?: LoadModelOptions
  ): Promise<void> {
    const shouldRetainView = this.hasLoadedModel
    const savedCameraState = shouldRetainView
      ? this.cameraManager.getCameraState()
      : null

    if (!shouldRetainView) {
      this.cameraManager.reset()
      this.controlsManager.reset()
    }
    this.gizmoManager.detach()
    this.modelManager.clearModel()
    this.animationManager.dispose()

    await this.loaderManager.loadModel(url, originalFileName, options)

    if (this.modelManager.currentModel) {
      this.animationManager.setupModelAnimations(
        this.modelManager.currentModel,
        this.modelManager.originalModel
      )
      this.hasLoadedModel = true
    }

    if (savedCameraState) {
      if (
        savedCameraState.cameraType !==
        this.cameraManager.getCurrentCameraType()
      ) {
        this.toggleCamera(savedCameraState.cameraType)
      }
      this.cameraManager.setCameraState(savedCameraState)
    }

    this.handleResize()

    this.loadingPromise = null
  }

  isSplatModel(): boolean {
    return this.adapterRef.current?.kind === 'splat'
  }

  isPlyModel(): boolean {
    return this.adapterRef.current?.kind === 'pointCloud'
  }

  getCurrentModelCapabilities(): ModelAdapterCapabilities {
    return this.adapterRef.capabilities ?? DEFAULT_MODEL_CAPABILITIES
  }

  clearModel(): void {
    this.animationManager.dispose()
    this.gizmoManager.detach()
    this.modelManager.clearModel()
    this.adapterRef.current = null
    this.hasLoadedModel = false
    this.forceRender()
  }

  setUpDirection(direction: UpDirection): void {
    this.modelManager.setUpDirection(direction)
    this.forceRender()
  }

  async loadHDRI(url: string): Promise<void> {
    await this.hdriManager.loadHDRI(url)
    this.forceRender()
  }

  setHDRIEnabled(enabled: boolean): void {
    this.hdriManager.setEnabled(enabled)
    this.lightingManager.setHDRIMode(enabled)
    this.forceRender()
  }

  setHDRIAsBackground(show: boolean): void {
    this.hdriManager.setShowAsBackground(show)
    this.forceRender()
  }

  setHDRIIntensity(intensity: number): void {
    this.hdriManager.setIntensity(intensity)
    this.forceRender()
  }

  clearHDRI(): void {
    this.hdriManager.clear()
    this.lightingManager.setHDRIMode(false)
    this.forceRender()
  }

  emitModelReady(): void {
    this.eventManager.emitEvent('modelReady', null)
  }

  captureScene(width: number, height: number): Promise<CaptureResult> {
    this.gizmoManager.removeFromScene()

    return this.sceneManager.captureScene(width, height).finally(() => {
      this.gizmoManager.ensureHelperInScene()
    })
  }

  public async startRecording(): Promise<void> {
    this.viewHelperManager.visibleViewHelper(false)

    return this.recordingManager.startRecording(
      this.targetWidth,
      this.targetHeight
    )
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

  public setAnimationSpeed(speed: number): void {
    this.animationManager.setAnimationSpeed(speed)
  }

  public updateSelectedAnimation(index: number): void {
    this.animationManager.updateSelectedAnimation(index)
  }

  public toggleAnimation(play?: boolean): void {
    this.animationManager.toggleAnimation(play)
  }

  public hasAnimations(): boolean {
    return this.animationManager.animationClips.length > 0
  }

  public hasSkeleton(): boolean {
    return this.modelManager.hasSkeleton()
  }

  public setShowSkeleton(show: boolean): void {
    this.modelManager.setShowSkeleton(show)
    this.forceRender()
  }

  public getShowSkeleton(): boolean {
    return this.modelManager.showSkeleton
  }

  public getAnimationTime(): number {
    return this.animationManager.getAnimationTime()
  }

  public getAnimationDuration(): number {
    return this.animationManager.getAnimationDuration()
  }

  public setAnimationTime(time: number): void {
    this.animationManager.setAnimationTime(time)
    this.forceRender()
  }

  public async captureThumbnail(
    width: number = 256,
    height: number = 256
  ): Promise<string> {
    if (!this.modelManager.currentModel) {
      throw new Error('No model loaded for thumbnail capture')
    }

    const savedState = this.cameraManager.getCameraState()
    const savedCameraType = this.cameraManager.getCurrentCameraType()
    const savedGridVisible = this.sceneManager.gridHelper.visible

    try {
      this.sceneManager.gridHelper.visible = false

      if (savedCameraType !== 'perspective') {
        this.cameraManager.toggleCamera('perspective')
      }

      positionThumbnailCamera(
        this.cameraManager.perspectiveCamera,
        this.modelManager.currentModel
      )

      if (this.controlsManager.controls) {
        const box = new THREE.Box3().setFromObject(
          this.modelManager.currentModel
        )
        this.controlsManager.controls.target.copy(
          box.getCenter(new THREE.Vector3())
        )
        this.controlsManager.controls.update()
      }

      const result = await this.captureScene(width, height)
      return result.scene
    } finally {
      this.sceneManager.gridHelper.visible = savedGridVisible

      if (savedCameraType !== 'perspective') {
        this.cameraManager.toggleCamera(savedCameraType)
      }
      this.cameraManager.setCameraState(savedState)
      this.controlsManager.controls?.update()

      this.forceRender()
    }
  }

  public setGizmoEnabled(enabled: boolean): void {
    if (enabled && !this.getCurrentModelCapabilities().gizmoTransform) return
    this.gizmoManager.setEnabled(enabled)
    this.forceRender()
  }

  public setGizmoMode(mode: GizmoMode): void {
    if (!this.getCurrentModelCapabilities().gizmoTransform) return
    this.gizmoManager.setMode(mode)
    this.forceRender()
  }

  public resetGizmoTransform(): void {
    if (!this.getCurrentModelCapabilities().gizmoTransform) return
    this.gizmoManager.reset()
    this.forceRender()
  }

  public applyGizmoTransform(
    position: { x: number; y: number; z: number },
    rotation: { x: number; y: number; z: number },
    scale?: { x: number; y: number; z: number }
  ): void {
    if (!this.getCurrentModelCapabilities().gizmoTransform) return
    this.gizmoManager.applyTransform(position, rotation, scale)
    this.forceRender()
  }

  public applyModelTransform(transform: Model3DTransform): void {
    if (!this.getCurrentModelCapabilities().gizmoTransform) return
    this.gizmoManager.applyModelTransform(transform)
    this.forceRender()
  }

  public getGizmoTransform(): {
    position: { x: number; y: number; z: number }
    rotation: { x: number; y: number; z: number }
    scale: { x: number; y: number; z: number }
  } {
    return this.gizmoManager.getTransform()
  }

  public getModelInfo(): Model3DTransform | null {
    return this.gizmoManager.getModelInfo()
  }

  public fitToViewer(): void {
    this.modelManager.fitToViewer()
    this.forceRender()
  }

  public centerCameraOnModel(): void {
    const bounds = this.modelManager.getCurrentBounds()
    if (!bounds || bounds.isEmpty()) return

    const center = bounds.getCenter(new THREE.Vector3())
    const camera = this.cameraManager.activeCamera
    const controls = this.controlsManager.controls
    const offset = center.clone().sub(camera.position)

    camera.position.add(offset)
    controls.target.add(offset)
    camera.updateMatrixWorld(true)
    controls.update()
    this.forceRender()
  }

  protected override disposeManagers(): void {
    super.disposeManagers()
    this.hdriManager.dispose()
    this.loaderManager.dispose()
    this.modelManager.dispose()
    this.adapterRef.current = null
    this.recordingManager.dispose()
    this.animationManager.dispose()
    this.gizmoManager.dispose()
  }
}

export default Load3d
