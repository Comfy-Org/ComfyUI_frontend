import * as THREE from 'three'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls'

import type { DraggingChangeListener } from './types'

type ChangeListener = (target: THREE.Vector3Like) => void

export class TargetHandle {
  private readonly proxy: THREE.Object3D
  private readonly controls: TransformControls
  private readonly helper: THREE.Object3D
  private suppressEcho = false
  private scene: THREE.Scene | null = null
  private disposed = false

  constructor(
    camera: THREE.Camera,
    domElement: HTMLElement,
    private readonly onDraggingChange: DraggingChangeListener,
    private readonly onChange: ChangeListener
  ) {
    this.proxy = new THREE.Object3D()
    this.proxy.name = 'CameraInfoTargetProxy'

    this.controls = new TransformControls(camera, domElement)
    this.controls.setMode('translate')
    this.controls.setSize(0.8)
    this.controls.attach(this.proxy)
    this.helper = this.controls.getHelper()
    this.helper.name = 'CameraInfoTargetHandle'
    this.helper.visible = false
    this.controls.enabled = false

    this.controls.addEventListener('dragging-changed', this.onDragging)
    this.controls.addEventListener('objectChange', this.onObjectChange)
  }

  attach(scene: THREE.Scene): void {
    this.scene = scene
    scene.add(this.proxy)
    scene.add(this.helper)
  }

  detach(): void {
    if (!this.scene) return
    this.scene.remove(this.proxy)
    this.scene.remove(this.helper)
    this.scene = null
  }

  setVisible(visible: boolean): void {
    this.helper.visible = visible
    this.controls.enabled = visible
  }

  isVisible(): boolean {
    return this.helper.visible
  }

  setTarget(target: THREE.Vector3Like): void {
    if (
      this.proxy.position.x === target.x &&
      this.proxy.position.y === target.y &&
      this.proxy.position.z === target.z
    ) {
      return
    }
    this.suppressEcho = true
    try {
      this.proxy.position.set(target.x, target.y, target.z)
      this.proxy.updateMatrixWorld(true)
    } finally {
      this.suppressEcho = false
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.controls.removeEventListener('dragging-changed', this.onDragging)
    this.controls.removeEventListener('objectChange', this.onObjectChange)
    this.controls.detach()
    this.detach()
    this.controls.dispose()
  }

  private readonly onDragging = (event: { value: unknown }): void => {
    this.onDraggingChange(event.value === true)
  }

  private readonly onObjectChange = (): void => {
    if (this.suppressEcho) return
    this.onChange({
      x: this.proxy.position.x,
      y: this.proxy.position.y,
      z: this.proxy.position.z
    })
  }
}
