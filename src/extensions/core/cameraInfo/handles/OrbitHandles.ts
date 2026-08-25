import * as THREE from 'three'

import type { CameraInfoState } from '../types'

const RING_RADIUS = 1.5
const HANDLE_RADIUS = 0.08
const GLOW_RADIUS = 0.12
const TUBE_RADIUS = 0.025
const ARC_PITCH_LIMIT = 85
const ARC_SEGMENTS = 32

const YAW_COLOR = 0x00d4ff
const PITCH_COLOR = 0xff66ff
const DISTANCE_COLOR = 0xffcc00

const BASE_GLOW_OPACITY = 0.25
const HOVER_GLOW_OPACITY = 0.6
const HOVER_SCALE = 1.35

export type OrbitHandleType = 'yaw' | 'pitch' | 'distance'

const DEG2RAD = Math.PI / 180

function buildArcCurve(): THREE.CatmullRomCurve3 {
  const points: THREE.Vector3[] = []
  for (let deg = -ARC_PITCH_LIMIT; deg <= ARC_PITCH_LIMIT; deg += 5) {
    const r = deg * DEG2RAD
    points.push(
      new THREE.Vector3(0, RING_RADIUS * Math.sin(r), RING_RADIUS * Math.cos(r))
    )
  }
  return new THREE.CatmullRomCurve3(points)
}

function makeHandle(color: number, type: OrbitHandleType): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(HANDLE_RADIUS, 32, 32),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.7,
      roughness: 0.3,
      metalness: 0.2
    })
  )
  mesh.userData.handleType = type
  return mesh
}

function makeGlow(color: number): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(GLOW_RADIUS, 16, 16),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: BASE_GLOW_OPACITY,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  )
}

export class OrbitHandles {
  private readonly root = new THREE.Group()
  private readonly yawGroup = new THREE.Group()

  private readonly yawRing: THREE.Mesh
  private readonly pitchArc: THREE.Mesh
  private readonly distanceLine: THREE.Line
  private readonly distanceLineGeometry: THREE.BufferGeometry

  private readonly yawHandle: THREE.Mesh
  private readonly pitchHandle: THREE.Mesh
  private readonly distanceHandle: THREE.Mesh

  private readonly yawHandleGlow: THREE.Mesh
  private readonly pitchHandleGlow: THREE.Mesh
  private readonly distanceHandleGlow: THREE.Mesh

  private scene: THREE.Scene | null = null
  private disposed = false

  constructor() {
    this.root.name = 'CameraInfoOrbitHandles'
    this.root.add(this.yawGroup)

    this.yawRing = new THREE.Mesh(
      new THREE.TorusGeometry(RING_RADIUS, TUBE_RADIUS, 16, 96),
      new THREE.MeshBasicMaterial({
        color: YAW_COLOR,
        transparent: true,
        opacity: 0.55
      })
    )
    this.yawRing.rotation.x = Math.PI / 2
    this.root.add(this.yawRing)

    this.pitchArc = new THREE.Mesh(
      new THREE.TubeGeometry(
        buildArcCurve(),
        ARC_SEGMENTS,
        TUBE_RADIUS,
        8,
        false
      ),
      new THREE.MeshBasicMaterial({
        color: PITCH_COLOR,
        transparent: true,
        opacity: 0.55
      })
    )
    this.yawGroup.add(this.pitchArc)

    this.distanceLineGeometry = new THREE.BufferGeometry()
    this.distanceLineGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 1], 3)
    )
    this.distanceLine = new THREE.Line(
      this.distanceLineGeometry,
      new THREE.LineBasicMaterial({
        color: DISTANCE_COLOR,
        transparent: true,
        opacity: 0.55
      })
    )
    this.yawGroup.add(this.distanceLine)

    this.yawHandle = makeHandle(YAW_COLOR, 'yaw')
    this.yawHandleGlow = makeGlow(YAW_COLOR)
    this.yawHandle.add(this.yawHandleGlow)
    this.root.add(this.yawHandle)

    this.pitchHandle = makeHandle(PITCH_COLOR, 'pitch')
    this.pitchHandleGlow = makeGlow(PITCH_COLOR)
    this.pitchHandle.add(this.pitchHandleGlow)
    this.yawGroup.add(this.pitchHandle)

    this.distanceHandle = makeHandle(DISTANCE_COLOR, 'distance')
    this.distanceHandleGlow = makeGlow(DISTANCE_COLOR)
    this.distanceHandle.add(this.distanceHandleGlow)
    this.yawGroup.add(this.distanceHandle)
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
      this.yawRing.geometry,
      this.yawRing.material as THREE.Material,
      this.pitchArc.geometry,
      this.pitchArc.material as THREE.Material,
      this.distanceLineGeometry,
      this.distanceLine.material as THREE.Material,
      this.yawHandle.geometry,
      this.yawHandle.material as THREE.Material,
      this.pitchHandle.geometry,
      this.pitchHandle.material as THREE.Material,
      this.distanceHandle.geometry,
      this.distanceHandle.material as THREE.Material,
      this.yawHandleGlow.geometry,
      this.yawHandleGlow.material as THREE.Material,
      this.pitchHandleGlow.geometry,
      this.pitchHandleGlow.material as THREE.Material,
      this.distanceHandleGlow.geometry,
      this.distanceHandleGlow.material as THREE.Material
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
    const visible = state.mode === 'orbit'
    this.root.visible = visible
    if (!visible) return

    this.root.position.set(state.target.x, state.target.y, state.target.z)

    const yawRad = state.orbit.yaw * DEG2RAD
    const pitchRad = state.orbit.pitch * DEG2RAD
    const cosP = Math.cos(pitchRad)
    const sinP = Math.sin(pitchRad)

    this.yawGroup.rotation.y = yawRad

    this.yawHandle.position.set(
      RING_RADIUS * Math.sin(yawRad),
      0,
      RING_RADIUS * Math.cos(yawRad)
    )

    this.pitchHandle.position.set(0, RING_RADIUS * sinP, RING_RADIUS * cosP)

    const endY = state.orbit.distance * sinP
    const endZ = state.orbit.distance * cosP
    this.distanceHandle.position.set(0, endY, endZ)

    const positions = this.distanceLineGeometry.attributes
      .position as THREE.BufferAttribute
    positions.setXYZ(1, 0, endY, endZ)
    positions.needsUpdate = true
  }

  pickableMeshes(): THREE.Object3D[] {
    return [this.yawHandle, this.pitchHandle, this.distanceHandle]
  }

  setHovered(type: OrbitHandleType | null): void {
    const entries: [THREE.Mesh, THREE.Mesh, OrbitHandleType][] = [
      [this.yawHandle, this.yawHandleGlow, 'yaw'],
      [this.pitchHandle, this.pitchHandleGlow, 'pitch'],
      [this.distanceHandle, this.distanceHandleGlow, 'distance']
    ]
    for (const [handle, glow, handleType] of entries) {
      const active = handleType === type
      handle.scale.setScalar(active ? HOVER_SCALE : 1)
      ;(glow.material as THREE.MeshBasicMaterial).opacity = active
        ? HOVER_GLOW_OPACITY
        : BASE_GLOW_OPACITY
    }
  }

  dragPlaneFor(type: OrbitHandleType, state: CameraInfoState): THREE.Plane {
    if (type === 'yaw') {
      return new THREE.Plane(new THREE.Vector3(0, 1, 0), -state.target.y)
    }
    const yawRad = state.orbit.yaw * DEG2RAD
    const normal = new THREE.Vector3(
      -Math.cos(yawRad),
      0,
      Math.sin(yawRad)
    ).normalize()
    const targetVec = vec(state.target)
    return new THREE.Plane().setFromNormalAndCoplanarPoint(normal, targetVec)
  }
}

const vec = (v: THREE.Vector3Like): THREE.Vector3 =>
  new THREE.Vector3(v.x, v.y, v.z)
