import * as THREE from 'three'

import { computeSubjectTransform } from '@/extensions/core/cameraInfo/cameraTransform'

import { toHandleOrbitState } from './cameraAngleMath'
import { ORBIT_SPHERE_RADIUS, SUBJECT_CENTER } from './types'
import type { CameraAngleState } from './types'

const SPHERE_COLOR = 0x8a93a6
const SPHERE_OPACITY = 0.14
const MARKER_COLOR = 0xffcc00
const MARKER_BODY = { width: 0.22, height: 0.14, depth: 0.12 }
const MARKER_LENS = { radius: 0.06, length: 0.08 }

export class OrbitSphere {
  private readonly mesh: THREE.Mesh
  private scene: THREE.Scene | null = null

  constructor() {
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(ORBIT_SPHERE_RADIUS, 12, 8),
      new THREE.MeshBasicMaterial({
        color: SPHERE_COLOR,
        wireframe: true,
        transparent: true,
        opacity: SPHERE_OPACITY,
        depthWrite: false
      })
    )
    this.mesh.name = 'CameraAngleOrbitSphere'
    this.mesh.position.set(SUBJECT_CENTER.x, SUBJECT_CENTER.y, SUBJECT_CENTER.z)
  }

  attach(scene: THREE.Scene): void {
    this.scene = scene
    scene.add(this.mesh)
  }

  setVisible(visible: boolean): void {
    this.mesh.visible = visible
  }

  isVisible(): boolean {
    return this.mesh.visible
  }

  dispose(): void {
    this.scene?.remove(this.mesh)
    this.scene = null
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
  }
}

export class CameraMarker {
  private readonly group = new THREE.Group()
  private readonly body: THREE.Mesh
  private readonly lens: THREE.Mesh
  private scene: THREE.Scene | null = null

  constructor() {
    this.group.name = 'CameraAngleCameraMarker'
    const material = new THREE.MeshStandardMaterial({
      color: MARKER_COLOR,
      emissive: MARKER_COLOR,
      emissiveIntensity: 0.45,
      roughness: 0.4,
      metalness: 0.2
    })
    this.body = new THREE.Mesh(
      new THREE.BoxGeometry(
        MARKER_BODY.width,
        MARKER_BODY.height,
        MARKER_BODY.depth
      ),
      material
    )
    this.lens = new THREE.Mesh(
      new THREE.CylinderGeometry(
        MARKER_LENS.radius,
        MARKER_LENS.radius * 0.8,
        MARKER_LENS.length,
        16
      ),
      material
    )
    this.lens.rotation.x = Math.PI / 2
    this.lens.position.z = -(MARKER_BODY.depth + MARKER_LENS.length) / 2
    this.group.add(this.body)
    this.group.add(this.lens)
  }

  attach(scene: THREE.Scene): void {
    this.scene = scene
    scene.add(this.group)
  }

  update(state: CameraAngleState): void {
    const { position, quaternion } = computeSubjectTransform(
      toHandleOrbitState(state)
    )
    this.group.position.copy(position)
    this.group.quaternion.copy(quaternion)
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible
  }

  isVisible(): boolean {
    return this.group.visible
  }

  dispose(): void {
    this.scene?.remove(this.group)
    this.scene = null
    this.body.geometry.dispose()
    this.lens.geometry.dispose()
    ;(this.body.material as THREE.Material).dispose()
  }
}
