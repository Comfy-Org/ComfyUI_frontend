import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

import {
  type ControlsManagerInterface,
  type EventManagerInterface
} from './interfaces'

export class ControlsManager implements ControlsManagerInterface {
  controls: OrbitControls
  private eventManager: EventManagerInterface
  private camera: THREE.Camera
  private requestRender: (() => void) | null = null
  private animationRafId: number | null = null
  private animationCleanup: (() => void) | null = null

  constructor(
    renderer: THREE.WebGLRenderer,
    camera: THREE.Camera,
    eventManager: EventManagerInterface
  ) {
    this.eventManager = eventManager
    this.camera = camera

    const container = renderer.domElement.parentElement || renderer.domElement
    this.controls = new OrbitControls(camera, container)
    this.controls.enableDamping = true
  }

  setRequestRender(callback: () => void): void {
    this.requestRender = callback
  }

  init(): void {
    this.controls.addEventListener('end', () => {
      this.eventManager.emitEvent('cameraChanged', this.buildCameraState())
    })
  }

  setTarget(point: THREE.Vector3, distance?: number): void {
    this.animateTarget(point, distance, 0)
  }

  animateTarget(
    point: THREE.Vector3,
    distance?: number,
    durationMs: number = 450
  ): void {
    this.cancelAnimation()
    const { endTarget, endPosition } = this.computeFocusEnd(point, distance)

    if (durationMs <= 0) {
      this.controls.target.copy(endTarget)
      this.camera.position.copy(endPosition)
      this.controls.update()
      this.requestRender?.()
      this.eventManager.emitEvent('cameraChanged', this.buildCameraState())
      return
    }

    const startTarget = this.controls.target.clone()
    const startPosition = this.camera.position.clone()

    // If a user grabs the controls mid-animation, abandon the tween so we
    // don't fight their input.
    const cancelOnInteract = () => this.cancelAnimation()
    this.controls.addEventListener('start', cancelOnInteract)
    this.animationCleanup = () => {
      this.controls.removeEventListener('start', cancelOnInteract)
    }

    const startTime = performance.now()
    const tick = () => {
      const t = Math.min((performance.now() - startTime) / durationMs, 1)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
      this.controls.target.lerpVectors(startTarget, endTarget, eased)
      this.camera.position.lerpVectors(startPosition, endPosition, eased)
      this.controls.update()
      this.requestRender?.()

      if (t >= 1) {
        this.cancelAnimation()
        this.eventManager.emitEvent('cameraChanged', this.buildCameraState())
        return
      }
      this.animationRafId = requestAnimationFrame(tick)
    }
    this.animationRafId = requestAnimationFrame(tick)
  }

  private computeFocusEnd(
    point: THREE.Vector3,
    distance?: number
  ): { endTarget: THREE.Vector3; endPosition: THREE.Vector3 } {
    const offset = this.camera.position.clone().sub(this.controls.target)
    const currentDistance = offset.length()
    const newDistance = distance ?? currentDistance
    const direction =
      currentDistance > 1e-6
        ? offset.divideScalar(currentDistance)
        : new THREE.Vector3(0, 0, 1)
    return {
      endTarget: point.clone(),
      endPosition: point.clone().addScaledVector(direction, newDistance)
    }
  }

  private cancelAnimation(): void {
    if (this.animationRafId !== null) {
      cancelAnimationFrame(this.animationRafId)
      this.animationRafId = null
    }
    this.animationCleanup?.()
    this.animationCleanup = null
  }

  private buildCameraState() {
    return {
      position: this.camera.position.clone(),
      target: this.controls.target.clone(),
      zoom:
        this.camera instanceof THREE.OrthographicCamera
          ? (this.camera as THREE.OrthographicCamera).zoom
          : (this.camera as THREE.PerspectiveCamera).zoom,
      cameraType:
        this.camera instanceof THREE.PerspectiveCamera
          ? 'perspective'
          : 'orthographic'
    }
  }

  dispose(): void {
    this.cancelAnimation()
    this.controls.dispose()
  }

  handleResize(): void {}

  update(): void {
    this.controls.update()
  }

  updateCamera(camera: THREE.Camera): void {
    const position = this.controls.object.position.clone()
    const target = this.controls.target.clone()

    this.camera = camera
    this.controls.object = camera
    this.controls.target = target
    camera.position.copy(position)
    this.controls.update()
  }
  reset(): void {
    this.controls.target.set(0, 0, 0)
    this.controls.update()
  }
}
