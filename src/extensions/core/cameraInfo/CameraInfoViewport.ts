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
import { PointerInteraction } from './handles/pointerInteraction'
import type { PointerPosition } from './handles/pointerInteraction'
import { pointToRollAngle } from './handles/rollDragMath'
import { dollySubjectByWheel, rotateSubjectByDrag } from './lookThroughDragMath'
import type { LookThroughResult } from './lookThroughDragMath'
import { fitCameraAspect, renderInsetPreview } from './subjectCameraPreview'
import { DEFAULT_CAMERA_INFO_STATE } from './types'
import type {
  CameraInfoFieldName,
  CameraInfoMode,
  CameraInfoState
} from './types'

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
  private readonly pointerNdc = new THREE.Vector2()
  private readonly dragPoint = new THREE.Vector3()
  private readonly input: PointerInteraction<DragHandleType>
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

    this.input = new PointerInteraction<DragHandleType>({
      canvas: this.canvas,
      pickHandle: (position) => this.pickHandle(position),
      dragHandle: (type, position) => this.dragHandle(type, position),
      hoverChanged: (type) => {
        this.orbitHandles.setHovered(type === 'roll' ? null : type)
        this.rollHandle.setHovered(type === 'roll')
        this.viewport.forceRender()
      },
      handleDragChanged: (dragging) => {
        this.viewport.controlsManager.controls.enabled = !dragging
      },
      freeDragEnabled: () => this.lookingThrough,
      freeDrag: (dx, dy) =>
        this.applyResult(
          rotateSubjectByDrag(
            this.overlay.getState(),
            -dx * LOOK_THROUGH_SENSITIVITY,
            -dy * LOOK_THROUGH_SENSITIVITY
          )
        ),
      wheelEnabled: () => this.lookingThrough,
      wheel: (deltaY) =>
        this.applyResult(dollySubjectByWheel(this.overlay.getState(), deltaY)),
      idleCursor: () => (this.input.hoveredHandle ? 'grab' : '')
    })
    this.input.attach()

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
    this.input.cancel()
    this.refreshGizmoVisibility()
    if (on) this.fitSubjectAspect()
    this.viewport.setExternalActiveCamera(
      on ? this.overlay.getSubjectCamera() : null
    )
    if (!on) this.viewport.viewHelperManager.visibleViewHelper(false)
  }

  remove(): void {
    this.input.detach()
    this.input.cancel()
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

  private updatePointer({ clientX, clientY }: PointerPosition): void {
    const rect = this.canvas.getBoundingClientRect()
    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1
    this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1
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

  private pickHandle(position: PointerPosition): DragHandleType | null {
    if (!this.gizmosOn || this.lookingThrough) return null
    const targets = this.pickableTargetsFor(this.overlay.getState().mode)
    if (targets.length === 0) return null
    this.updatePointer(position)
    return pickHandleAtPointer<DragHandleType>(
      this.raycaster,
      this.pointerNdc,
      this.viewport.cameraManager.activeCamera,
      targets,
      this.canvas
    )
  }

  private dragHandle(type: DragHandleType, position: PointerPosition): void {
    this.updatePointer(position)
    this.raycaster.setFromCamera(
      this.pointerNdc,
      this.viewport.cameraManager.activeCamera
    )

    const state = this.overlay.getState()
    const plane =
      type === 'roll'
        ? this.rollHandle.dragPlane(state)
        : this.orbitHandles.dragPlaneFor(type, state)
    if (!this.raycaster.ray.intersectPlane(plane, this.dragPoint)) return

    const { fieldName, value, nextState } = computeNextState(
      type,
      state,
      this.dragPoint
    )
    this.applyState(nextState)
    this.onHandleDrag?.(fieldName, value)
  }

  private applyResult(result: LookThroughResult | null): void {
    if (!result) return
    this.applyState(result.nextState)
    for (const update of result.updates) {
      this.onHandleDrag?.(update.fieldName, update.value)
    }
  }

  private fitSubjectAspect(): void {
    const canvas = this.viewport.domElement
    fitCameraAspect(
      this.overlay.getSubjectCamera(),
      canvas.width / canvas.height
    )
  }

  private renderSubjectCameraPreview(): void {
    renderInsetPreview({
      renderer: this.viewport.renderer,
      canvas: this.viewport.domElement,
      scene: this.viewport.sceneManager.scene,
      camera: this.overlay.getSubjectCamera(),
      hidden: [
        {
          isVisible: () => this.overlay.isHelperVisible(),
          setVisible: (visible) => this.overlay.setHelperVisible(visible)
        },
        this.orbitHandles,
        this.rollHandle,
        this.targetHandle,
        this.cameraHandle
      ]
    })
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
