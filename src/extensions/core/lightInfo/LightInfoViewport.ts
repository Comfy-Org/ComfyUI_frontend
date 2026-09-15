import * as THREE from 'three'

import { pickHandleAtPointer } from '@/extensions/core/cameraInfo/handles/handlePicking'
import {
  pointToDistance,
  pointToPitchAngle,
  pointToYawAngle
} from '@/extensions/core/cameraInfo/handles/orbitDragMath'
import type { Viewport3d } from '@/extensions/core/load3d/Viewport3d'
import { createViewport3d } from '@/extensions/core/load3d/createViewport3d'
import type { Load3DOptions } from '@/extensions/core/load3d/interfaces'

import { LightInfoOverlay } from './LightInfoOverlay'
import {
  LightOrbitHandles,
  type LightOrbitHandleType
} from './handles/LightOrbitHandles'
import { PositionHandle } from './handles/PositionHandle'
import { orbitAnglesFor, orbitPosition } from './lightTransform'
import { lightTarget, type LightInfoEntry, type LightInfoType } from './types'

export type LightTransformGizmoMode = 'none' | 'light-position' | 'target'

const OUTPUT_VIEW = {
  position: { x: 0, y: 6, z: 8 },
  target: { x: 0, y: -0.5, z: 0 },
  fov: 35
} as const

export interface LightInfoViewportOptions extends Load3DOptions {
  onLightsChange?: (lights: LightInfoEntry[]) => void
  onSelectLight?: (index: number) => void
}

interface DragState {
  type: LightOrbitHandleType
  pointerId: number
}

export class LightInfoViewport {
  readonly viewport: Viewport3d
  readonly overlay: LightInfoOverlay
  readonly orbitHandles: LightOrbitHandles
  readonly positionHandle: PositionHandle
  readonly targetHandle: PositionHandle

  private readonly onLightsChange?: LightInfoViewportOptions['onLightsChange']
  private readonly onSelectLight?: LightInfoViewportOptions['onSelectLight']
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2()

  private dragState: DragState | null = null
  private hoveredHandle: LightOrbitHandleType | null = null
  private hoveredMarker = false
  private gizmosOn = true
  private cameraLocked = false
  private transformGizmoMode: LightTransformGizmoMode = 'none'

  constructor(
    container: HTMLElement,
    initialLights: LightInfoEntry[] = [],
    options?: LightInfoViewportOptions
  ) {
    this.onLightsChange = options?.onLightsChange
    this.onSelectLight = options?.onSelectLight
    this.viewport = createViewport3d(container, options)
    this.viewport.viewHelperManager.visibleViewHelper(false)
    this.viewport.sceneManager.toggleGrid(false)
    this.viewport.lightingManager.setLightIntensity(0)
    this.viewport.renderer.shadowMap.enabled = true
    this.viewport.renderer.shadowMap.type = THREE.PCFShadowMap

    this.overlay = new LightInfoOverlay(initialLights)
    this.viewport.setOverlay(this.overlay)

    this.orbitHandles = new LightOrbitHandles()
    this.orbitHandles.attach(this.viewport.sceneManager.scene)

    this.positionHandle = new PositionHandle(
      'LightInfoPositionHandle',
      this.viewport.cameraManager.activeCamera,
      this.viewport.domElement,
      (dragging) => {
        this.viewport.controlsManager.controls.enabled =
          !dragging && !this.cameraLocked
      },
      (position) => {
        this.mutateSelected((light) => ({
          ...light,
          position: { ...position }
        }))
      }
    )
    this.positionHandle.attach(this.viewport.sceneManager.scene)

    this.targetHandle = new PositionHandle(
      'LightInfoTargetHandle',
      this.viewport.cameraManager.activeCamera,
      this.viewport.domElement,
      (dragging) => {
        this.viewport.controlsManager.controls.enabled =
          !dragging && !this.cameraLocked
      },
      (target) => {
        this.mutateSelected((light) => ({ ...light, target: { ...target } }))
      }
    )
    this.targetHandle.attach(this.viewport.sceneManager.scene)

    this.syncHandles()
    this.attachPointerHandlers()
  }

  applyLights(lights: LightInfoEntry[], selectedIndex: number): void {
    this.overlay.applyLights(lights, selectedIndex)
    this.syncHandles()
    this.refreshGizmoVisibility()
    this.viewport.forceRender()
  }

  setGizmosVisible(on: boolean): void {
    if (this.gizmosOn === on) return
    this.gizmosOn = on
    this.overlay.setHelpersVisible(on)
    this.refreshGizmoVisibility()
    this.viewport.forceRender()
  }

  setTransformGizmoMode(mode: LightTransformGizmoMode): void {
    if (this.transformGizmoMode === mode) return
    this.transformGizmoMode = mode
    this.refreshGizmoVisibility()
    this.viewport.forceRender()
  }

  resetViewToOutput(): void {
    this.viewport.setCameraState({
      position: new THREE.Vector3(
        OUTPUT_VIEW.position.x,
        OUTPUT_VIEW.position.y,
        OUTPUT_VIEW.position.z
      ),
      target: new THREE.Vector3(
        OUTPUT_VIEW.target.x,
        OUTPUT_VIEW.target.y,
        OUTPUT_VIEW.target.z
      ),
      zoom: 1,
      cameraType: 'perspective',
      fov: OUTPUT_VIEW.fov
    })
    this.viewport.forceRender()
  }

  setCameraLocked(locked: boolean): void {
    if (this.cameraLocked === locked) return
    this.cameraLocked = locked
    this.viewport.controlsManager.controls.enabled = !locked
  }

  remove(): void {
    this.detachPointerHandlers()
    this.canvas.style.cursor = ''
    this.orbitHandles.dispose()
    this.positionHandle.dispose()
    this.targetHandle.dispose()
    this.viewport.remove()
  }

  private get selectedLight(): LightInfoEntry | null {
    return this.overlay.getSelectedLight()
  }

  private mutateSelected(
    mutate: (light: LightInfoEntry) => LightInfoEntry
  ): void {
    const lights = this.overlay.getLights()
    const index = this.overlay.getSelectedIndex()
    if (index < 0 || !lights[index]) return
    lights[index] = mutate(lights[index])
    this.applyLights(lights, index)
    this.onLightsChange?.(lights)
  }

  private syncHandles(): void {
    const light = this.selectedLight
    this.orbitHandles.update(light)
    if (!light) return
    this.positionHandle.setPosition(light.position)
    this.targetHandle.setPosition(lightTarget(light))
  }

  private refreshGizmoVisibility(): void {
    const light = this.selectedLight
    const type = light?.type ?? null
    this.orbitHandles.setVisible(this.gizmosOn && type === 'directional')

    const wantPosition =
      light !== null &&
      this.transformGizmoMode === 'light-position' &&
      lightPositionApplies(light.type)
    this.positionHandle.setVisible(wantPosition)

    const wantTarget =
      light !== null &&
      this.transformGizmoMode === 'target' &&
      targetApplies(light.type)
    this.targetHandle.setVisible(wantTarget)
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
  }

  private detachPointerHandlers(): void {
    const canvas = this.canvas
    canvas.removeEventListener('pointerdown', this.onPointerDown)
    canvas.removeEventListener('pointermove', this.onPointerMove)
    canvas.removeEventListener('pointerup', this.onPointerUp)
    canvas.removeEventListener('pointercancel', this.onPointerUp)
    canvas.removeEventListener('pointerleave', this.onPointerLeave)
  }

  private readonly onPointerLeave = (): void => {
    if (this.dragState) return
    this.setHoveredHandle(null)
    this.setHoveredMarker(false)
  }

  private updatePointer(event: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  }

  private pickHandle(event: PointerEvent): LightOrbitHandleType | null {
    if (!this.gizmosOn) return null
    if (this.selectedLight?.type !== 'directional') return null
    this.updatePointer(event)
    return pickHandleAtPointer<LightOrbitHandleType>(
      this.raycaster,
      this.pointer,
      this.viewport.cameraManager.activeCamera,
      this.orbitHandles.pickableMeshes(),
      this.canvas
    )
  }

  private pickMarker(event: PointerEvent): number | null {
    if (!this.gizmosOn) return null
    this.updatePointer(event)
    const picked = pickHandleAtPointer<string>(
      this.raycaster,
      this.pointer,
      this.viewport.cameraManager.activeCamera,
      this.overlay.markerMeshes(),
      this.canvas
    )
    if (picked === null) return null
    const index = Number(picked)
    return Number.isInteger(index) ? index : null
  }

  private setHoveredHandle(type: LightOrbitHandleType | null): void {
    if (this.hoveredHandle === type) return
    this.hoveredHandle = type
    this.orbitHandles.setHovered(type)
    this.refreshCursor()
    this.viewport.forceRender()
  }

  private setHoveredMarker(hovered: boolean): void {
    if (this.hoveredMarker === hovered) return
    this.hoveredMarker = hovered
    this.refreshCursor()
  }

  private refreshCursor(): void {
    this.canvas.style.cursor = this.hoveredHandle
      ? 'grab'
      : this.hoveredMarker
        ? 'pointer'
        : ''
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return
    const type = this.pickHandle(event)
    if (type) {
      this.setHoveredHandle(type)
      this.dragState = { type, pointerId: event.pointerId }
      this.canvas.setPointerCapture(event.pointerId)
      this.canvas.style.cursor = 'grabbing'
      this.viewport.controlsManager.controls.enabled = false
      event.stopPropagation()
      return
    }
    const markerIndex = this.pickMarker(event)
    if (markerIndex === null) return
    if (markerIndex !== this.overlay.getSelectedIndex()) {
      this.applyLights(this.overlay.getLights(), markerIndex)
      this.onSelectLight?.(markerIndex)
    }
    event.stopPropagation()
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.dragState) {
      const handle = this.pickHandle(event)
      this.setHoveredHandle(handle)
      this.setHoveredMarker(!handle && this.pickMarker(event) !== null)
      return
    }
    if (event.pointerId !== this.dragState.pointerId) return

    this.updatePointer(event)
    this.raycaster.setFromCamera(
      this.pointer,
      this.viewport.cameraManager.activeCamera
    )

    const light = this.selectedLight
    if (!light) return
    const plane = this.orbitHandles.dragPlaneFor(this.dragState.type, light)
    const point = new THREE.Vector3()
    if (!this.raycaster.ray.intersectPlane(plane, point)) return

    const handleType = this.dragState.type
    this.mutateSelected((current) => applyOrbitDrag(handleType, current, point))
  }

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) return
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId)
    }
    this.dragState = null
    this.viewport.controlsManager.controls.enabled = !this.cameraLocked
    this.refreshCursor()
  }
}

function applyOrbitDrag(
  type: LightOrbitHandleType,
  light: LightInfoEntry,
  point: THREE.Vector3
): LightInfoEntry {
  const target = lightTarget(light)
  const angles = orbitAnglesFor(light.position, target)
  if (type === 'yaw') {
    angles.yaw = pointToYawAngle(point, target)
  } else if (type === 'pitch') {
    angles.pitch = pointToPitchAngle(point, target, angles.yaw)
  } else {
    angles.distance = pointToDistance(point, target, angles.yaw, angles.pitch)
  }
  return {
    ...light,
    position: orbitPosition(target, angles.yaw, angles.pitch, angles.distance)
  }
}

export function lightPositionApplies(type: LightInfoType): boolean {
  return type === 'point' || type === 'spot'
}

export function targetApplies(type: LightInfoType): boolean {
  return type === 'directional' || type === 'spot'
}
