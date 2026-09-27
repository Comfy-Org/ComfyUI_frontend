import * as THREE from 'three'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls'

import type { DraggingChangeListener } from './types'

export type CameraHandleMode = 'translate' | 'rotate'

export interface CameraHandleTransform {
  position: THREE.Vector3Like
  quaternion: { x: number; y: number; z: number; w: number }
}

type ChangeListener = (
  transform: CameraHandleTransform,
  mode: CameraHandleMode
) => void

export class CameraHandle {
  private readonly proxy: THREE.Object3D
  private readonly controls: TransformControls
  private readonly helper: THREE.Object3D
  private mode: CameraHandleMode = 'translate'
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
    this.proxy.name = 'CameraInfoCameraProxy'

    this.controls = new TransformControls(camera, domElement)
    this.controls.setMode(this.mode)
    this.controls.setSize(0.8)
    this.controls.setSpace(spaceFor(this.mode))
    this.controls.attach(this.proxy)
    this.helper = this.controls.getHelper()
    this.helper.name = 'CameraInfoCameraHandle'
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

  setMode(mode: CameraHandleMode): void {
    if (this.mode === mode) return
    this.mode = mode
    this.controls.setMode(mode)
    this.controls.setSpace(spaceFor(mode))
  }

  getMode(): CameraHandleMode {
    return this.mode
  }

  setSubject(
    position: THREE.Vector3Like,
    quaternion: { x: number; y: number; z: number; w: number }
  ): void {
    const samePosition =
      this.proxy.position.x === position.x &&
      this.proxy.position.y === position.y &&
      this.proxy.position.z === position.z
    const sameQuaternion =
      this.proxy.quaternion.x === quaternion.x &&
      this.proxy.quaternion.y === quaternion.y &&
      this.proxy.quaternion.z === quaternion.z &&
      this.proxy.quaternion.w === quaternion.w
    if (samePosition && sameQuaternion) return
    this.suppressEcho = true
    try {
      this.proxy.position.set(position.x, position.y, position.z)
      this.proxy.quaternion.set(
        quaternion.x,
        quaternion.y,
        quaternion.z,
        quaternion.w
      )
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
    this.onChange(
      {
        position: {
          x: this.proxy.position.x,
          y: this.proxy.position.y,
          z: this.proxy.position.z
        },
        quaternion: {
          x: this.proxy.quaternion.x,
          y: this.proxy.quaternion.y,
          z: this.proxy.quaternion.z,
          w: this.proxy.quaternion.w
        }
      },
      this.mode
    )
  }
}

function spaceFor(mode: CameraHandleMode): 'world' | 'local' {
  return mode === 'translate' ? 'world' : 'local'
}
