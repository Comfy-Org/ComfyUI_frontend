import * as THREE from 'three'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls'

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

import type { GizmoMode } from './interfaces'

export class GizmoManager {
  private transformControls: TransformControls | null = null
  private targetObject: THREE.Object3D | null = null
  private initialPosition: THREE.Vector3 = new THREE.Vector3()
  private initialRotation: THREE.Euler = new THREE.Euler()
  private initialScale: THREE.Vector3 = new THREE.Vector3(1, 1, 1)
  private enabled: boolean = false
  private activeCamera: THREE.Camera
  private mode: GizmoMode = 'translate'
  private scene: THREE.Scene
  private renderer: THREE.WebGLRenderer
  private orbitControls: OrbitControls
  private onTransformChange?: () => void

  constructor(
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    orbitControls: OrbitControls,
    getActiveCamera: () => THREE.Camera,
    onTransformChange?: () => void
  ) {
    this.scene = scene
    this.renderer = renderer
    this.orbitControls = orbitControls
    this.activeCamera = getActiveCamera()
    this.onTransformChange = onTransformChange
  }

  init(): void {
    this.transformControls = new TransformControls(
      this.activeCamera,
      this.renderer.domElement
    )

    this.transformControls.addEventListener('dragging-changed', (event) => {
      this.orbitControls.enabled = !event.value
      if (!event.value && this.onTransformChange) {
        this.onTransformChange()
      }
    })

    const helper = this.transformControls.getHelper()
    helper.name = 'GizmoTransformControls'
    helper.renderOrder = 999
    this.scene.add(helper)
  }

  setupForModel(model: THREE.Object3D): void {
    if (!this.transformControls) return

    this.ensureHelperInScene()

    this.transformControls.detach()
    this.transformControls.enabled = false

    this.targetObject = model
    this.initialPosition.copy(model.position)
    this.initialRotation.copy(model.rotation)
    this.initialScale.copy(model.scale)

    if (this.enabled) {
      this.transformControls.attach(model)
      this.transformControls.setMode(this.mode)
      this.transformControls.enabled = true
    }
  }

  detach(): void {
    this.enabled = false
    if (this.transformControls) {
      this.transformControls.detach()
      this.transformControls.enabled = false
    }
    this.targetObject = null
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled

    if (!this.transformControls) return

    this.ensureHelperInScene()

    if (enabled && this.targetObject) {
      this.transformControls.attach(this.targetObject)
      this.transformControls.setMode(this.mode)
      this.transformControls.enabled = true
    } else {
      this.transformControls.detach()
      this.transformControls.enabled = false
    }
  }

  ensureHelperInScene(): void {
    if (!this.transformControls) return
    const helper = this.transformControls.getHelper()
    if (!helper.parent) {
      this.scene.add(helper)
    }
  }

  removeFromScene(): void {
    if (!this.transformControls) return
    const helper = this.transformControls.getHelper()
    if (helper.parent) {
      helper.parent.remove(helper)
    }
  }

  isEnabled(): boolean {
    return this.enabled
  }

  updateCamera(camera: THREE.Camera): void {
    this.activeCamera = camera
    if (this.transformControls) {
      this.transformControls.camera = camera
    }
  }

  setMode(mode: GizmoMode): void {
    this.mode = mode

    if (this.transformControls) {
      this.transformControls.setMode(mode)
    }
  }

  getMode(): GizmoMode {
    return this.mode
  }

  reset(): void {
    if (!this.targetObject) return

    this.targetObject.position.copy(this.initialPosition)
    this.targetObject.rotation.copy(this.initialRotation)
    this.targetObject.scale.copy(this.initialScale)
    this.onTransformChange?.()
  }

  applyTransform(
    position: { x: number; y: number; z: number },
    rotation: { x: number; y: number; z: number },
    scale?: { x: number; y: number; z: number }
  ): void {
    if (!this.targetObject) return
    this.targetObject.position.set(position.x, position.y, position.z)
    this.targetObject.rotation.set(rotation.x, rotation.y, rotation.z)
    if (scale) {
      this.targetObject.scale.set(scale.x, scale.y, scale.z)
    }
  }

  getInitialTransform(): {
    position: { x: number; y: number; z: number }
    rotation: { x: number; y: number; z: number }
    scale: { x: number; y: number; z: number }
  } {
    return {
      position: {
        x: this.initialPosition.x,
        y: this.initialPosition.y,
        z: this.initialPosition.z
      },
      rotation: {
        x: this.initialRotation.x,
        y: this.initialRotation.y,
        z: this.initialRotation.z
      },
      scale: {
        x: this.initialScale.x,
        y: this.initialScale.y,
        z: this.initialScale.z
      }
    }
  }

  getTransform(): {
    position: { x: number; y: number; z: number }
    rotation: { x: number; y: number; z: number }
    scale: { x: number; y: number; z: number }
  } {
    if (!this.targetObject) {
      return {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      }
    }

    return {
      position: {
        x: this.targetObject.position.x,
        y: this.targetObject.position.y,
        z: this.targetObject.position.z
      },
      rotation: {
        x: this.targetObject.rotation.x,
        y: this.targetObject.rotation.y,
        z: this.targetObject.rotation.z
      },
      scale: {
        x: this.targetObject.scale.x,
        y: this.targetObject.scale.y,
        z: this.targetObject.scale.z
      }
    }
  }

  dispose(): void {
    if (this.transformControls) {
      const helper = this.transformControls.getHelper()
      this.scene.remove(helper)
      this.transformControls.detach()
      this.transformControls.dispose()
      this.transformControls = null
    }

    this.targetObject = null
  }
}
