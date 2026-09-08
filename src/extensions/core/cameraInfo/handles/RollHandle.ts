import * as THREE from 'three'

import { computeSubjectTransform } from '../cameraTransform'
import type { CameraInfoState } from '../types'
import { rollBasis } from './rollDragMath'

const RING_RADIUS = 0.9
const HANDLE_RADIUS = 0.08
const GLOW_RADIUS = 0.12
const TUBE_RADIUS = 0.025

const ROLL_COLOR = 0xff8800
const BASE_GLOW_OPACITY = 0.25
const HOVER_GLOW_OPACITY = 0.6
const HOVER_SCALE = 1.35

const DEG2RAD = Math.PI / 180

function makeHandle(): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(HANDLE_RADIUS, 32, 32),
    new THREE.MeshStandardMaterial({
      color: ROLL_COLOR,
      emissive: ROLL_COLOR,
      emissiveIntensity: 0.7,
      roughness: 0.3,
      metalness: 0.2
    })
  )
  mesh.userData.handleType = 'roll'
  return mesh
}

export class RollHandle {
  private readonly root = new THREE.Group()
  private readonly ring: THREE.Mesh
  private readonly handle: THREE.Mesh
  private readonly handleGlow: THREE.Mesh

  private scene: THREE.Scene | null = null
  private disposed = false

  constructor() {
    this.root.name = 'CameraInfoRollHandle'

    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(RING_RADIUS, TUBE_RADIUS, 16, 80),
      new THREE.MeshBasicMaterial({
        color: ROLL_COLOR,
        transparent: true,
        opacity: 0.55
      })
    )
    this.root.add(this.ring)

    this.handle = makeHandle()
    this.handleGlow = new THREE.Mesh(
      new THREE.SphereGeometry(GLOW_RADIUS, 16, 16),
      new THREE.MeshBasicMaterial({
        color: ROLL_COLOR,
        transparent: true,
        opacity: BASE_GLOW_OPACITY,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    )
    this.handle.add(this.handleGlow)
    this.root.add(this.handle)
  }

  attach(scene: THREE.Scene): void {
    this.scene = scene
    scene.add(this.root)
  }

  detach(): void {
    if (!this.scene) return
    this.scene.remove(this.root)
    this.scene = null
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.detach()
    const disposables: { dispose: () => void }[] = [
      this.ring.geometry,
      this.ring.material as THREE.Material,
      this.handle.geometry,
      this.handle.material as THREE.Material,
      this.handleGlow.geometry,
      this.handleGlow.material as THREE.Material
    ]
    for (const d of disposables) d.dispose()
  }

  setVisible(visible: boolean): void {
    this.root.visible = visible
  }

  isVisible(): boolean {
    return this.root.visible
  }

  update(state: CameraInfoState): void {
    if (state.mode === 'quaternion') {
      this.root.visible = false
      return
    }
    this.root.visible = true

    const { position: cameraPos } = computeSubjectTransform(state)
    const { up, right, backward } = rollBasis(state.target, cameraPos)

    this.root.position.set(state.target.x, state.target.y, state.target.z)
    const orient = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(right, up, backward)
    )
    this.root.quaternion.copy(orient)

    const theta = state.roll * DEG2RAD
    this.handle.position.set(
      RING_RADIUS * Math.sin(theta),
      RING_RADIUS * Math.cos(theta),
      0
    )
  }

  pickableMeshes(): THREE.Object3D[] {
    return [this.handle]
  }

  setHovered(hovered: boolean): void {
    this.handle.scale.setScalar(hovered ? HOVER_SCALE : 1)
    ;(this.handleGlow.material as THREE.MeshBasicMaterial).opacity = hovered
      ? HOVER_GLOW_OPACITY
      : BASE_GLOW_OPACITY
  }

  dragPlane(state: CameraInfoState): THREE.Plane {
    const { position: cameraPos } = computeSubjectTransform(state)
    const { backward } = rollBasis(state.target, cameraPos)
    const tgt = new THREE.Vector3(
      state.target.x,
      state.target.y,
      state.target.z
    )
    return new THREE.Plane().setFromNormalAndCoplanarPoint(backward, tgt)
  }
}
