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
  private readonly interactionElement: HTMLElement
  private suppressionScope: HTMLElement | null = null

  constructor(
    renderer: THREE.WebGLRenderer,
    camera: THREE.Camera,
    eventManager: EventManagerInterface
  ) {
    this.eventManager = eventManager
    this.camera = camera

    const container = renderer.domElement.parentElement || renderer.domElement
    this.interactionElement = container as HTMLElement
    this.controls = new OrbitControls(camera, container)
    this.controls.enableDamping = true
    this.interactionElement.addEventListener(
      'pointerdown',
      this.armContextMenuSuppression
    )
    this.interactionElement.addEventListener(
      'pointerup',
      this.scheduleContextMenuDisarm
    )
    this.interactionElement.addEventListener(
      'pointercancel',
      this.scheduleContextMenuDisarm
    )
  }

  private readonly armContextMenuSuppression = (event: PointerEvent): void => {
    if (event.button !== 2) return
    this.disarmContextMenuSuppression()
    this.suppressionScope =
      this.interactionElement.closest<HTMLElement>('[data-node-id]')
    this.suppressionScope?.addEventListener(
      'contextmenu',
      this.suppressContextMenu,
      { capture: true, once: true }
    )
  }

  private readonly suppressContextMenu = (event: Event): void => {
    event.preventDefault()
    event.stopPropagation()
    this.suppressionScope = null
  }

  private readonly scheduleContextMenuDisarm = (event: PointerEvent): void => {
    if (event.button !== 2) return
    requestAnimationFrame(() => this.disarmContextMenuSuppression())
  }

  private disarmContextMenuSuppression(): void {
    this.suppressionScope?.removeEventListener(
      'contextmenu',
      this.suppressContextMenu,
      { capture: true }
    )
    this.suppressionScope = null
  }

  init(): void {
    this.controls.addEventListener('end', () => {
      const cameraState = {
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

      this.eventManager.emitEvent('cameraChanged', cameraState)
    })
  }

  dispose(): void {
    this.interactionElement.removeEventListener(
      'pointerdown',
      this.armContextMenuSuppression
    )
    this.interactionElement.removeEventListener(
      'pointerup',
      this.scheduleContextMenuDisarm
    )
    this.interactionElement.removeEventListener(
      'pointercancel',
      this.scheduleContextMenuDisarm
    )
    this.disarmContextMenuSuppression()
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

  detach(): void {
    this.controls.enabled = false
  }

  attach(): void {
    this.controls.enabled = true
  }

  reset(): void {
    this.controls.target.set(0, 0, 0)
    this.controls.update()
  }
}
