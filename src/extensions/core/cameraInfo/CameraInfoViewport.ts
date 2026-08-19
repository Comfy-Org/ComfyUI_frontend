import * as THREE from 'three'

import type { Viewport3d } from '@/extensions/core/load3d/Viewport3d'
import { createViewport3d } from '@/extensions/core/load3d/createViewport3d'
import type { Load3DOptions } from '@/extensions/core/load3d/interfaces'

import { CameraInfoOverlay } from './CameraInfoOverlay'
import { computeSubjectTransform } from './cameraTransform'
import { CameraHandle } from './handles/CameraHandle'
import type {
  CameraHandleMode,
  CameraHandleTransform
} from './handles/CameraHandle'
import { OrbitHandles } from './handles/OrbitHandles'
import type { OrbitHandleType } from './handles/OrbitHandles'
import { RollHandle } from './handles/RollHandle'
import { TargetHandle } from './handles/TargetHandle'
import { pickHandleAtPointer } from './handles/handlePicking'
import {
  pointToDistance,
  pointToPitchAngle,
  pointToYawAngle
} from './handles/orbitDragMath'
import { pointToRollAngle } from './handles/rollDragMath'
import { dollySubjectByWheel, rotateSubjectByDrag } from './lookThroughDragMath'
import type { LookThroughResult } from './lookThroughDragMath'
import { DEFAULT_CAMERA_INFO_STATE } from './types'
import type {
  CameraInfoFieldName,
  CameraInfoMode,
  CameraInfoState
} from './types'

const PREVIEW_WIDTH = 200
const PREVIEW_HEIGHT = 150
const PREVIEW_PADDING = 8
const PREVIEW_BORDER_COLOR = 0x2a2a2a
const LOOK_THROUGH_SENSITIVITY = 0.005

type DragHandleType = OrbitHandleType | 'roll'

export type TransformGizmoMode =
  | 'none'
  | 'target'
  | 'camera-translate'
  | 'camera-rotate'

const FIELD_NAME_FOR: Record<OrbitHandleType, CameraInfoFieldName> = {
  yaw: 'mode.yaw',
  pitch: 'mode.pitch',
  distance: 'mode.distance'
}

export interface CameraInfoViewportOptions extends Load3DOptions {
  onHandleDrag?: (fieldName: CameraInfoFieldName, value: number) => void
}

interface DragState {
  type: DragHandleType
  pointerId: number
}

export class CameraInfoViewport {
  readonly viewport: Viewport3d
  readonly overlay: CameraInfoOverlay
  readonly orbitHandles: OrbitHandles
  readonly rollHandle: RollHandle
  readonly targetHandle: TargetHandle
  readonly cameraHandle: CameraHandle

  private readonly disposePreRender: () => void
  private readonly disposePostRender: () => void
  private readonly onHandleDrag?: CameraInfoViewportOptions['onHandleDrag']
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2()

  private dragState: DragState | null = null
  private lookThroughDrag: {
    pointerId: number
    lastX: number
    lastY: number
  } | null = null
  private pendingRotation: { dx: number; dy: number } | null = null
  private pendingDolly: number | null = null
  private inputFrame: number | null = null
  private hoveredHandle: DragHandleType | null = null
  private gizmosOn = true
  private lookingThrough = false
  private transformGizmoMode: TransformGizmoMode = 'none'

  constructor(
    container: HTMLElement,
    initialState: CameraInfoState = DEFAULT_CAMERA_INFO_STATE,
    options?: CameraInfoViewportOptions
  ) {
    this.onHandleDrag = options?.onHandleDrag
    this.viewport = createViewport3d(container, options)
    this.viewport.viewHelperManager.visibleViewHelper(false)
    this.overlay = new CameraInfoOverlay(initialState)
    this.viewport.setOverlay(this.overlay)

    this.orbitHandles = new OrbitHandles()
    this.orbitHandles.attach(this.viewport.sceneManager.scene)
    this.orbitHandles.update(initialState)

    this.rollHandle = new RollHandle()
    this.rollHandle.attach(this.viewport.sceneManager.scene)
    this.rollHandle.update(initialState)

    this.targetHandle = new TargetHandle(
      this.viewport.cameraManager.activeCamera,
      this.viewport.domElement,
      (dragging) => {
        this.viewport.controlsManager.controls.enabled = !dragging
      },
      (target) => {
        const next: CameraInfoState = { ...this.overlay.getState(), target }
        this.applyDerivedState(next)
        this.onHandleDrag?.('target_x', target.x)
        this.onHandleDrag?.('target_y', target.y)
        this.onHandleDrag?.('target_z', target.z)
      }
    )
    this.targetHandle.attach(this.viewport.sceneManager.scene)
    this.targetHandle.setTarget(initialState.target)

    this.cameraHandle = new CameraHandle(
      this.viewport.cameraManager.activeCamera,
      this.viewport.domElement,
      (dragging) => {
        this.viewport.controlsManager.controls.enabled = !dragging
      },
      (transform, mode) => this.handleCameraDrag(transform, mode)
    )
    this.cameraHandle.attach(this.viewport.sceneManager.scene)
    this.syncCameraHandleSubject(initialState)

    this.attachPointerHandlers()

    this.disposePreRender = this.viewport.addPreRenderCallback(() => {
      if (this.lookingThrough) this.fitSubjectAspect()
    })
    this.disposePostRender = this.viewport.addPostRenderCallback(() => {
      if (!this.lookingThrough) this.renderSubjectCameraPreview()
    })
  }

  applyState(state: CameraInfoState): void {
    this.overlay.applyState(state)
    this.orbitHandles.update(state)
    this.rollHandle.update(state)
    this.targetHandle.setTarget(state.target)
    this.syncCameraHandleSubject(state)
    this.refreshGizmoVisibility()
    if (this.lookingThrough) {
      this.viewport.setExternalActiveCamera(this.overlay.getSubjectCamera())
    }
    this.viewport.forceRender()
  }

  setGizmosVisible(on: boolean): void {
    if (this.gizmosOn === on) return
    this.gizmosOn = on
    this.refreshGizmoVisibility()
    this.viewport.forceRender()
  }

  setTransformGizmoMode(mode: TransformGizmoMode): void {
    if (this.transformGizmoMode === mode) return
    this.transformGizmoMode = mode
    this.refreshGizmoVisibility()
    this.viewport.forceRender()
  }

  setLookThrough(on: boolean): void {
    if (this.lookingThrough === on) return
    this.lookingThrough = on
    this.lookThroughDrag = null
    this.cancelInputFrame()
    this.canvas.style.cursor = ''
    this.refreshGizmoVisibility()
    if (on) this.fitSubjectAspect()
    this.viewport.setExternalActiveCamera(
      on ? this.overlay.getSubjectCamera() : null
    )
    if (!on) this.viewport.viewHelperManager.visibleViewHelper(false)
  }

  remove(): void {
    this.detachPointerHandlers()
    this.cancelInputFrame()
    this.canvas.style.cursor = ''
    this.disposePreRender()
    this.disposePostRender()
    this.orbitHandles.dispose()
    this.rollHandle.dispose()
    this.targetHandle.dispose()
    this.cameraHandle.dispose()
    this.viewport.remove()
  }

  private refreshGizmoVisibility(): void {
    if (this.lookingThrough) {
      this.orbitHandles.setVisible(false)
      this.rollHandle.setVisible(false)
      this.targetHandle.setVisible(false)
      this.cameraHandle.setVisible(false)
      return
    }
    const mode = this.overlay.getState().mode
    this.orbitHandles.setVisible(this.gizmosOn && mode === 'orbit')
    this.rollHandle.setVisible(this.gizmosOn && rollApplies(mode))

    const wantTarget =
      this.gizmosOn &&
      this.transformGizmoMode === 'target' &&
      targetApplies(mode)
    this.targetHandle.setVisible(wantTarget)

    const wantTranslate =
      this.gizmosOn &&
      this.transformGizmoMode === 'camera-translate' &&
      cameraTranslateApplies(mode)
    const wantRotate =
      this.gizmosOn &&
      this.transformGizmoMode === 'camera-rotate' &&
      cameraRotateApplies(mode)
    const wantCamera = wantTranslate || wantRotate
    if (wantCamera)
      this.cameraHandle.setMode(wantRotate ? 'rotate' : 'translate')
    this.cameraHandle.setVisible(wantCamera)
  }

  private syncCameraHandleSubject(state: CameraInfoState): void {
    const { position, quaternion } = computeSubjectTransform(state)
    this.cameraHandle.setSubject(
      { x: position.x, y: position.y, z: position.z },
      { x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w }
    )
  }

  private applyDerivedState(next: CameraInfoState): void {
    this.overlay.applyState(next)
    this.orbitHandles.update(next)
    this.rollHandle.update(next)
    this.targetHandle.setTarget(next.target)
    this.syncCameraHandleSubject(next)
    this.refreshGizmoVisibility()
    this.viewport.forceRender()
  }

  private handleCameraDrag(
    transform: CameraHandleTransform,
    mode: CameraHandleMode
  ): void {
    const state = this.overlay.getState()
    const next = nextStateForCameraDrag(state, transform, mode)
    this.applyDerivedState(next)
    if (mode === 'translate') {
      this.onHandleDrag?.('mode.position_x', transform.position.x)
      this.onHandleDrag?.('mode.position_y', transform.position.y)
      this.onHandleDrag?.('mode.position_z', transform.position.z)
    } else {
      this.onHandleDrag?.('mode.quat_x', transform.quaternion.x)
      this.onHandleDrag?.('mode.quat_y', transform.quaternion.y)
      this.onHandleDrag?.('mode.quat_z', transform.quaternion.z)
      this.onHandleDrag?.('mode.quat_w', transform.quaternion.w)
    }
  }

  private get canvas(): HTMLCanvasElement {
    return this.viewport.domElement
  }

  private attachPointerHandlers(): void {
    const canvas = this.canvas
    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointermove', this.onPointerMove)
    canvas.addEventListener('pointerup', this.onPointerUp)
    canvas.addEventListener('pointercancel', this.onPointerUp)
    canvas.addEventListener('pointerleave', this.onPointerLeave)
    canvas.addEventListener('wheel', this.onWheel, { passive: false })
  }

  private detachPointerHandlers(): void {
    const canvas = this.canvas
    canvas.removeEventListener('pointerdown', this.onPointerDown)
    canvas.removeEventListener('pointermove', this.onPointerMove)
    canvas.removeEventListener('pointerup', this.onPointerUp)
    canvas.removeEventListener('pointercancel', this.onPointerUp)
    canvas.removeEventListener('pointerleave', this.onPointerLeave)
    canvas.removeEventListener('wheel', this.onWheel)
  }

  private readonly onPointerLeave = (): void => {
    if (this.dragState || this.lookThroughDrag) return
    this.setHoveredHandle(null)
  }

  private readonly onWheel = (event: WheelEvent): void => {
    if (!this.lookingThrough) return
    event.preventDefault()
    event.stopPropagation()
    this.queueDolly(event.deltaY)
  }

  private updatePointer(event: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  }

  private pickableTargetsFor(mode: CameraInfoMode): THREE.Object3D[] {
    const targets: THREE.Object3D[] = []
    if (mode === 'orbit') {
      targets.push(...this.orbitHandles.pickableMeshes())
    }
    if (rollApplies(mode)) {
      targets.push(...this.rollHandle.pickableMeshes())
    }
    return targets
  }

  private pickHandle(event: PointerEvent): DragHandleType | null {
    if (!this.gizmosOn || this.lookingThrough) return null
    const targets = this.pickableTargetsFor(this.overlay.getState().mode)
    if (targets.length === 0) return null
    this.updatePointer(event)
    return pickHandleAtPointer<DragHandleType>(
      this.raycaster,
      this.pointer,
      this.viewport.cameraManager.activeCamera,
      targets,
      this.canvas
    )
  }

  private setHoveredHandle(type: DragHandleType | null): void {
    if (this.hoveredHandle === type) return
    this.hoveredHandle = type
    this.orbitHandles.setHovered(type === 'roll' ? null : type)
    this.rollHandle.setHovered(type === 'roll')
    this.canvas.style.cursor = type ? 'grab' : ''
    this.viewport.forceRender()
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return

    if (this.lookingThrough) {
      this.lookThroughDrag = {
        pointerId: event.pointerId,
        lastX: event.clientX,
        lastY: event.clientY
      }
      this.canvas.setPointerCapture(event.pointerId)
      this.canvas.style.cursor = 'grabbing'
      event.stopPropagation()
      return
    }

    const type = this.pickHandle(event)
    if (!type) return

    this.setHoveredHandle(type)
    this.dragState = { type, pointerId: event.pointerId }
    this.canvas.setPointerCapture(event.pointerId)
    this.canvas.style.cursor = 'grabbing'
    this.viewport.controlsManager.controls.enabled = false
    event.stopPropagation()
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.lookThroughDrag) {
      if (event.pointerId !== this.lookThroughDrag.pointerId) return
      const dx = event.clientX - this.lookThroughDrag.lastX
      const dy = event.clientY - this.lookThroughDrag.lastY
      this.lookThroughDrag.lastX = event.clientX
      this.lookThroughDrag.lastY = event.clientY
      this.queueRotation(dx, dy)
      return
    }

    if (!this.dragState) {
      this.setHoveredHandle(this.pickHandle(event))
      return
    }
    if (event.pointerId !== this.dragState.pointerId) return

    this.updatePointer(event)
    this.raycaster.setFromCamera(
      this.pointer,
      this.viewport.cameraManager.activeCamera
    )

    const state = this.overlay.getState()
    const plane =
      this.dragState.type === 'roll'
        ? this.rollHandle.dragPlane(state)
        : this.orbitHandles.dragPlaneFor(this.dragState.type, state)
    const point = new THREE.Vector3()
    if (!this.raycaster.ray.intersectPlane(plane, point)) return

    const { fieldName, value, nextState } = computeNextState(
      this.dragState.type,
      state,
      point
    )
    this.applyState(nextState)
    this.onHandleDrag?.(fieldName, value)
  }

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (this.lookThroughDrag) {
      if (event.pointerId !== this.lookThroughDrag.pointerId) return
      if (this.canvas.hasPointerCapture(event.pointerId)) {
        this.canvas.releasePointerCapture(event.pointerId)
      }
      this.lookThroughDrag = null
      this.flushInput()
      this.cancelInputFrame()
      this.canvas.style.cursor = ''
      return
    }

    if (!this.dragState || event.pointerId !== this.dragState.pointerId) return
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId)
    }
    this.dragState = null
    this.viewport.controlsManager.controls.enabled = true
    this.canvas.style.cursor = this.hoveredHandle ? 'grab' : ''
  }

  private queueRotation(dx: number, dy: number): void {
    this.pendingRotation = {
      dx: (this.pendingRotation?.dx ?? 0) + dx,
      dy: (this.pendingRotation?.dy ?? 0) + dy
    }
    this.scheduleInputFrame()
  }

  private queueDolly(deltaY: number): void {
    this.pendingDolly = (this.pendingDolly ?? 0) + deltaY
    this.scheduleInputFrame()
  }

  private scheduleInputFrame(): void {
    if (this.inputFrame !== null) return
    this.inputFrame = requestAnimationFrame(() => {
      this.inputFrame = null
      this.flushInput()
    })
  }

  private flushInput(): void {
    const rotation = this.pendingRotation
    const dolly = this.pendingDolly
    this.pendingRotation = null
    this.pendingDolly = null
    if (rotation) {
      this.applyResult(
        rotateSubjectByDrag(
          this.overlay.getState(),
          -rotation.dx * LOOK_THROUGH_SENSITIVITY,
          -rotation.dy * LOOK_THROUGH_SENSITIVITY
        )
      )
    }
    if (dolly !== null) {
      this.applyResult(dollySubjectByWheel(this.overlay.getState(), dolly))
    }
  }

  private applyResult(result: LookThroughResult | null): void {
    if (!result) return
    this.applyState(result.nextState)
    for (const update of result.updates) {
      this.onHandleDrag?.(update.fieldName, update.value)
    }
  }

  private cancelInputFrame(): void {
    if (this.inputFrame !== null) {
      cancelAnimationFrame(this.inputFrame)
      this.inputFrame = null
    }
    this.pendingRotation = null
    this.pendingDolly = null
  }

  private fitSubjectAspect(): void {
    const canvas = this.viewport.domElement
    const aspect = canvas.width / canvas.height
    if (!Number.isFinite(aspect) || aspect <= 0) return
    const cam = this.overlay.getSubjectCamera()
    if (cam instanceof THREE.PerspectiveCamera) {
      if (Math.abs(cam.aspect - aspect) < 1e-4) return
      cam.aspect = aspect
      cam.updateProjectionMatrix()
      return
    }
    if (cam instanceof THREE.OrthographicCamera) {
      const half = (cam.top - cam.bottom) / 2 || 1
      const left = -half * aspect
      const right = half * aspect
      if (
        Math.abs(cam.left - left) < 1e-4 &&
        Math.abs(cam.right - right) < 1e-4
      )
        return
      cam.left = left
      cam.right = right
      cam.updateProjectionMatrix()
    }
  }

  private renderSubjectCameraPreview(): void {
    const renderer = this.viewport.renderer
    const canvas = this.viewport.domElement
    const canvasWidth = canvas.width
    const canvasHeight = canvas.height
    if (
      canvasWidth < PREVIEW_WIDTH + PREVIEW_PADDING * 2 ||
      canvasHeight < PREVIEW_HEIGHT + PREVIEW_PADDING * 2
    ) {
      return
    }

    const cam = this.overlay.getSubjectCamera()
    const aspect = PREVIEW_WIDTH / PREVIEW_HEIGHT
    let savedAspect: number | undefined
    let savedOrtho:
      | {
          left: number
          right: number
          top: number
          bottom: number
        }
      | undefined

    if (cam instanceof THREE.PerspectiveCamera) {
      savedAspect = cam.aspect
      cam.aspect = aspect
      cam.updateProjectionMatrix()
    } else if (cam instanceof THREE.OrthographicCamera) {
      savedOrtho = {
        left: cam.left,
        right: cam.right,
        top: cam.top,
        bottom: cam.bottom
      }
      const half = (cam.top - cam.bottom) / 2 || 1
      cam.left = -half * aspect
      cam.right = half * aspect
      cam.top = half
      cam.bottom = -half
      cam.updateProjectionMatrix()
    }

    this.overlay.setHelperVisible(false)
    const handlesWereVisible = this.orbitHandles.isVisible()
    const rollWasVisible = this.rollHandle.isVisible()
    const targetWasVisible = this.targetHandle.isVisible()
    const cameraWasVisible = this.cameraHandle.isVisible()
    this.orbitHandles.setVisible(false)
    this.rollHandle.setVisible(false)
    this.targetHandle.setVisible(false)
    this.cameraHandle.setVisible(false)

    const x = canvasWidth - PREVIEW_WIDTH - PREVIEW_PADDING
    const y = PREVIEW_PADDING

    renderer.setViewport(x - 1, y - 1, PREVIEW_WIDTH + 2, PREVIEW_HEIGHT + 2)
    renderer.setScissor(x - 1, y - 1, PREVIEW_WIDTH + 2, PREVIEW_HEIGHT + 2)
    renderer.setScissorTest(true)
    renderer.setClearColor(PREVIEW_BORDER_COLOR)
    renderer.clear()

    renderer.setViewport(x, y, PREVIEW_WIDTH, PREVIEW_HEIGHT)
    renderer.setScissor(x, y, PREVIEW_WIDTH, PREVIEW_HEIGHT)
    renderer.setClearColor(0x0a0a0a)
    renderer.clear()
    renderer.render(this.viewport.sceneManager.scene, cam)

    this.overlay.setHelperVisible(true)
    if (handlesWereVisible) this.orbitHandles.setVisible(true)
    if (rollWasVisible) this.rollHandle.setVisible(true)
    if (targetWasVisible) this.targetHandle.setVisible(true)
    if (cameraWasVisible) this.cameraHandle.setVisible(true)

    if (savedAspect !== undefined && cam instanceof THREE.PerspectiveCamera) {
      cam.aspect = savedAspect
      cam.updateProjectionMatrix()
    } else if (savedOrtho && cam instanceof THREE.OrthographicCamera) {
      cam.left = savedOrtho.left
      cam.right = savedOrtho.right
      cam.top = savedOrtho.top
      cam.bottom = savedOrtho.bottom
      cam.updateProjectionMatrix()
    }
  }
}

interface OrbitDragResult {
  fieldName: CameraInfoFieldName
  value: number
  nextState: CameraInfoState
}

function computeNextState(
  type: DragHandleType,
  state: CameraInfoState,
  point: THREE.Vector3
): OrbitDragResult {
  if (type === 'roll') {
    const cameraPos = computeSubjectTransform(state).position
    const value = pointToRollAngle(
      { x: point.x, y: point.y, z: point.z },
      state.target,
      { x: cameraPos.x, y: cameraPos.y, z: cameraPos.z }
    )
    return {
      fieldName: 'roll',
      value,
      nextState: { ...state, roll: value }
    }
  }
  const fieldName = FIELD_NAME_FOR[type]
  if (type === 'yaw') {
    const value = pointToYawAngle(point, state.target)
    return {
      fieldName,
      value,
      nextState: { ...state, orbit: { ...state.orbit, yaw: value } }
    }
  }
  if (type === 'pitch') {
    const value = pointToPitchAngle(point, state.target, state.orbit.yaw)
    return {
      fieldName,
      value,
      nextState: { ...state, orbit: { ...state.orbit, pitch: value } }
    }
  }
  const value = pointToDistance(
    point,
    state.target,
    state.orbit.yaw,
    state.orbit.pitch
  )
  return {
    fieldName,
    value,
    nextState: { ...state, orbit: { ...state.orbit, distance: value } }
  }
}

function targetApplies(mode: CameraInfoMode): boolean {
  return mode === 'orbit' || mode === 'look_at'
}

function cameraTranslateApplies(mode: CameraInfoMode): boolean {
  return mode === 'look_at' || mode === 'quaternion'
}

function cameraRotateApplies(mode: CameraInfoMode): boolean {
  return mode === 'quaternion'
}

function rollApplies(mode: CameraInfoMode): boolean {
  return mode === 'orbit' || mode === 'look_at'
}

function nextStateForCameraDrag(
  state: CameraInfoState,
  transform: CameraHandleTransform,
  mode: CameraHandleMode
): CameraInfoState {
  const { position, quaternion } = transform
  if (mode === 'translate') {
    if (state.mode === 'look_at') {
      return { ...state, lookAt: { position: { ...position } } }
    }
    if (state.mode === 'quaternion') {
      return {
        ...state,
        quaternion: { ...state.quaternion, position: { ...position } }
      }
    }
    return state
  }
  if (state.mode === 'quaternion') {
    return {
      ...state,
      quaternion: { ...state.quaternion, quat: { ...quaternion } }
    }
  }
  return state
}
