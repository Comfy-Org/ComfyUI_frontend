import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

import type { ControlsManagerInterface } from './interfaces'

export class ControlsManager implements ControlsManagerInterface {
  controls: OrbitControls

  constructor(interactionElement: HTMLElement, camera: THREE.Camera) {
    this.controls = new OrbitControls(camera, interactionElement)
    this.controls.enableDamping = true
  }

  init(): void {}

  dispose(): void {
    this.controls.dispose()
  }

  handleResize(): void {}

  update(): void {
    this.controls.update()
  }

  updateCamera(camera: THREE.Camera): void {
    const position = this.controls.object.position.clone()
    const target = this.controls.target.clone()

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
