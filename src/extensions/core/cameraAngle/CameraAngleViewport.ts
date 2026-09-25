import * as THREE from 'three'

import { OrbitHandles } from '@/extensions/core/cameraInfo/handles/OrbitHandles'
import type { OrbitHandleType } from '@/extensions/core/cameraInfo/handles/OrbitHandles'
import { pickHandleAtPointer } from '@/extensions/core/cameraInfo/handles/handlePicking'
import { PointerInteraction } from '@/extensions/core/cameraInfo/handles/pointerInteraction'
import type { PointerPosition } from '@/extensions/core/cameraInfo/handles/pointerInteraction'
import {
  fitCameraAspect,
  renderInsetPreview
} from '@/extensions/core/cameraInfo/subjectCameraPreview'
import type { Viewport3d } from '@/extensions/core/load3d/Viewport3d'
import { createViewport3d } from '@/extensions/core/load3d/createViewport3d'
import type { Load3DOptions } from '@/extensions/core/load3d/interfaces'

import { SubjectBox } from './SubjectBox'
import type { SubjectBoxOptions } from './SubjectBox'
import {
  clampState,
  dollyByWheel,
  overviewDistance,
  rotateByDrag,
  stateFromHandleDrag,
  toHandleOrbitState
} from './cameraAngleMath'
import { CameraMarker, OrbitSphere } from './orbitGizmos'
import {
  CAMERA_ANGLE_LIMITS,
  DEFAULT_CAMERA_ANGLE_STATE,
  SUBJECT_CENTER,
  YAW_RING_LATITUDE
} from './types'
import type { CameraAngleState, CameraAngleViewMode } from './types'

const OVERVIEW_DIRECTION = new THREE.Vector3(2.4, 1.4, 4.2).normalize()
const DEFAULT_OVERVIEW_FOV = 35
const PREVIEW_SIZE_CSS = 150
const PREVIEW_MAX_FRACTION = 0.35
const PREVIEW_MARGIN_CSS = 8
const PREVIEW_BOTTOM_BAR_CSS = 48
const PREVIEW_BORDER_COLOR = 0x8a93a6
const DEFAULT_PREVIEW_BACKGROUND = 0x282828

export interface CameraAngleViewportOptions
  extends Load3DOptions, SubjectBoxOptions {
  onStateChange?: (state: CameraAngleState) => void
}

export class CameraAngleViewport {
  readonly viewport: Viewport3d
  readonly subject: SubjectBox
  readonly orbitHandles: OrbitHandles
  readonly orbitSphere: OrbitSphere
  readonly cameraMarker: CameraMarker

  private state: CameraAngleState
  private viewMode: CameraAngleViewMode = 'camera'
  private readonly onStateChange?: CameraAngleViewportOptions['onStateChange']
  private readonly disposePreRender: () => void
  private readonly disposePostRender: () => void
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointerNdc = new THREE.Vector2()
  private readonly dragPoint = new THREE.Vector3()
  private readonly input: PointerInteraction<OrbitHandleType>
  private overviewAspect: number | null = null
  private previewVisible = false
  private removed = false

  constructor(
    container: HTMLElement,
    initialState: CameraAngleState = DEFAULT_CAMERA_ANGLE_STATE,
    options?: CameraAngleViewportOptions
  ) {
    this.state = clampState(initialState)
    this.onStateChange = options?.onStateChange
    this.viewport = createViewport3d(container, options)
    this.viewport.viewHelperManager.visibleViewHelper(false)
    this.viewport.sceneManager.toggleGrid(false)
    this.viewport.controlsManager.controls.enabled = false
    this.fitOverviewCamera()

    this.subject = new SubjectBox(this.state, {
      loadTexture: options?.loadTexture,
      faceLabels: options?.faceLabels
    })
    this.viewport.setOverlay(this.subject)

    const scene = this.viewport.sceneManager.scene
    this.orbitSphere = new OrbitSphere()
    this.orbitSphere.attach(scene)
    this.cameraMarker = new CameraMarker()
    this.cameraMarker.attach(scene)
    this.orbitHandles = new OrbitHandles({
      pitchLimits: CAMERA_ANGLE_LIMITS.vertical,
      yawRingLatitude: YAW_RING_LATITUDE
    })
    this.orbitHandles.attach(scene)
    this.syncGizmos()

    this.input = new PointerInteraction<OrbitHandleType>({
      canvas: this.canvas,
      pickHandle: (position) => this.pickHandle(position),
      dragHandle: (type, position) => this.dragHandle(type, position),
      hoverChanged: (type) => {
        this.orbitHandles.setHovered(type)
        this.viewport.forceRender()
      },
      handleDragChanged: () => {},
      freeDragEnabled: () => this.viewMode === 'object',
      freeDrag: (dx, dy) => this.commit(rotateByDrag(this.state, dx, dy)),
      wheelEnabled: () => true,
      wheel: (deltaY) => this.commit(dollyByWheel(this.state, deltaY)),
      idleCursor: () =>
        this.viewMode === 'object' || this.input.hoveredHandle ? 'grab' : ''
    })
    this.input.attach()

    this.disposePreRender = this.viewport.addPreRenderCallback(() => {
      this.fitOverviewCamera()
      if (this.viewMode === 'object') this.fitSubjectAspect()
    })
    this.disposePostRender = this.viewport.addPostRenderCallback(() => {
      if (this.viewMode === 'camera' && this.previewVisible)
        this.renderSubjectPreview()
    })
  }

  getState(): CameraAngleState {
    return { ...this.state }
  }

  getViewMode(): CameraAngleViewMode {
    return this.viewMode
  }

  applyState(next: CameraAngleState): void {
    this.state = clampState(next)
    this.subject.applyState(this.state)
    this.syncGizmos()
    this.viewport.forceRender()
  }

  setViewMode(mode: CameraAngleViewMode): void {
    if (this.viewMode === mode) return
    this.viewMode = mode
    this.input.cancel()
    const lookingThrough = mode === 'object'
    this.syncGizmos()
    if (lookingThrough) this.fitSubjectAspect()
    this.viewport.setExternalActiveCamera(
      lookingThrough ? this.subject.getSubjectCamera() : null
    )
    this.viewport.controlsManager.controls.enabled = false
    if (!lookingThrough)
      this.viewport.viewHelperManager.visibleViewHelper(false)
    this.viewport.forceRender()
  }

  setPreviewVisible(visible: boolean): void {
    if (this.previewVisible === visible) return
    this.previewVisible = visible
    this.viewport.forceRender()
  }

  isPreviewVisible(): boolean {
    return this.previewVisible
  }

  async setImage(url: string | null): Promise<void> {
    const applied = await this.subject.setImage(url)
    if (applied && !this.removed) this.viewport.forceRender()
  }

  remove(): void {
    if (this.removed) return
    this.removed = true
    this.input.detach()
    this.input.cancel()
    this.canvas.style.cursor = ''
    this.disposePreRender()
    this.disposePostRender()
    this.orbitHandles.dispose()
    this.orbitSphere.dispose()
    this.cameraMarker.dispose()
    this.viewport.remove()
  }

  private get canvas(): HTMLCanvasElement {
    return this.viewport.domElement
  }

  private syncGizmos(): void {
    const visible = this.viewMode === 'camera'
    this.orbitHandles.update(toHandleOrbitState(this.state))
    this.orbitHandles.setVisible(visible)
    this.cameraMarker.update(this.state)
    this.cameraMarker.setVisible(visible)
    this.orbitSphere.setVisible(visible)
  }

  private commit(next: CameraAngleState): void {
    this.applyState(next)
    this.onStateChange?.(this.getState())
  }

  private updatePointer({ clientX, clientY }: PointerPosition): void {
    const rect = this.canvas.getBoundingClientRect()
    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1
    this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1
  }

  private pickHandle(position: PointerPosition): OrbitHandleType | null {
    if (this.viewMode !== 'camera') return null
    this.updatePointer(position)
    return pickHandleAtPointer<OrbitHandleType>(
      this.raycaster,
      this.pointerNdc,
      this.viewport.cameraManager.activeCamera,
      this.orbitHandles.pickableMeshes(),
      this.canvas
    )
  }

  private dragHandle(type: OrbitHandleType, position: PointerPosition): void {
    this.updatePointer(position)
    this.raycaster.setFromCamera(
      this.pointerNdc,
      this.viewport.cameraManager.activeCamera
    )
    const plane = this.orbitHandles.dragPlaneFor(
      type,
      toHandleOrbitState(this.state)
    )
    if (!this.raycaster.ray.intersectPlane(plane, this.dragPoint)) return
    this.commit(stateFromHandleDrag(type, this.state, this.dragPoint))
  }

  private fitOverviewCamera(): void {
    const aspect = this.canvas.width / this.canvas.height
    if (!Number.isFinite(aspect) || aspect <= 0) return
    if (aspect === this.overviewAspect) return
    this.overviewAspect = aspect
    const camera = this.viewport.cameraManager.activeCamera
    const fov =
      camera instanceof THREE.PerspectiveCamera
        ? camera.fov
        : DEFAULT_OVERVIEW_FOV
    const target = new THREE.Vector3(
      SUBJECT_CENTER.x,
      SUBJECT_CENTER.y,
      SUBJECT_CENTER.z
    )
    const position = OVERVIEW_DIRECTION.clone()
      .multiplyScalar(overviewDistance(aspect, fov))
      .add(target)
    this.viewport.setCameraState({
      position,
      target,
      zoom: 1,
      cameraType: 'perspective'
    })
  }

  private fitSubjectAspect(): void {
    fitCameraAspect(
      this.subject.getSubjectCamera(),
      this.canvas.width / this.canvas.height
    )
  }

  private renderSubjectPreview(): void {
    const canvas = this.canvas
    const pixelScale = canvas.clientHeight
      ? canvas.height / canvas.clientHeight
      : 1
    const side = Math.floor(
      Math.min(
        PREVIEW_SIZE_CSS * pixelScale,
        Math.min(canvas.width, canvas.height) * PREVIEW_MAX_FRACTION
      )
    )
    const background = this.viewport.sceneManager.getCurrentBackgroundInfo()
    renderInsetPreview({
      renderer: this.viewport.renderer,
      canvas,
      scene: this.viewport.sceneManager.scene,
      camera: this.subject.getSubjectCamera(),
      hidden: [this.orbitHandles, this.orbitSphere, this.cameraMarker],
      layout: {
        width: side,
        height: side,
        marginRight: PREVIEW_MARGIN_CSS * pixelScale,
        marginBottom: (PREVIEW_BOTTOM_BAR_CSS + PREVIEW_MARGIN_CSS) * pixelScale
      },
      borderColor: PREVIEW_BORDER_COLOR,
      backgroundColor:
        background.type === 'color'
          ? background.value
          : DEFAULT_PREVIEW_BACKGROUND
    })
  }
}
