import * as THREE from 'three'

import { computeSubjectTransform } from '@/extensions/core/cameraInfo/cameraTransform'
import type { SceneOverlay } from '@/extensions/core/load3d/interfaces'

import { clampState, toOrbitCameraInfoState } from './cameraAngleMath'
import {
  CAMERA_ANGLE_FOV,
  DEFAULT_CAMERA_ANGLE_STATE,
  DEFAULT_SUBJECT_FACE_LABELS,
  SUBJECT_CENTER,
  SUBJECT_HEIGHT
} from './types'
import type { CameraAngleState, SubjectFaceLabels } from './types'

const SUBJECT_CAMERA_NEAR = 0.1
const SUBJECT_CAMERA_FAR = 100
const FRONT_COLOR = 0xd8dbe2
const FACE_COLOR = '#2a2d36'
const FACE_GRID_COLOR = '#3d4150'
const FACE_TEXT_COLOR = '#aeb4c2'
const EDGE_COLOR = 0x1a1a1a
const FACE_TEXTURE_SIZE = 256
const FACE_GRID_CELL = 32
const FACE_FONT = 'bold 40px sans-serif'

export type TextureLoaderFn = (url: string) => Promise<THREE.Texture>

export interface SubjectBoxOptions {
  loadTexture?: TextureLoaderFn
  faceLabels?: SubjectFaceLabels
}

const loadTextureWithThree: TextureLoaderFn = (url) =>
  new THREE.TextureLoader().setCrossOrigin('anonymous').loadAsync(url)

function makeFaceTexture(label: string): THREE.CanvasTexture | null {
  const canvas = document.createElement('canvas')
  canvas.width = FACE_TEXTURE_SIZE
  canvas.height = FACE_TEXTURE_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = FACE_COLOR
  ctx.fillRect(0, 0, FACE_TEXTURE_SIZE, FACE_TEXTURE_SIZE)
  ctx.strokeStyle = FACE_GRID_COLOR
  ctx.lineWidth = 1
  for (let i = 0; i <= FACE_TEXTURE_SIZE; i += FACE_GRID_CELL) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, FACE_TEXTURE_SIZE)
    ctx.moveTo(0, i)
    ctx.lineTo(FACE_TEXTURE_SIZE, i)
    ctx.stroke()
  }
  ctx.fillStyle = FACE_TEXT_COLOR
  ctx.font = FACE_FONT
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, FACE_TEXTURE_SIZE / 2, FACE_TEXTURE_SIZE / 2)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function makeFaceMaterial(label: string): THREE.MeshBasicMaterial {
  const texture = makeFaceTexture(label)
  return new THREE.MeshBasicMaterial(
    texture ? { map: texture } : { color: FACE_COLOR }
  )
}

function centerCropToSquare(texture: THREE.Texture): void {
  const aspect = textureAspect(texture)
  const repeatX = aspect > 1 ? 1 / aspect : 1
  const repeatY = aspect < 1 ? aspect : 1
  texture.repeat.set(repeatX, repeatY)
  texture.offset.set((1 - repeatX) / 2, (1 - repeatY) / 2)
}

function textureAspect(texture: THREE.Texture): number {
  const image = texture.image as
    | { width?: number; height?: number }
    | null
    | undefined
  const width = image?.width ?? 0
  const height = image?.height ?? 0
  return width > 0 && height > 0 ? width / height : 1
}

export class SubjectBox implements SceneOverlay {
  private scene: THREE.Scene | null = null
  private state: CameraAngleState
  private readonly loadTexture: TextureLoaderFn

  private readonly group = new THREE.Group()
  private readonly box: THREE.Mesh
  private readonly edges: THREE.LineSegments
  private readonly frontMaterial: THREE.MeshBasicMaterial
  private readonly faceMaterials: THREE.MeshBasicMaterial[]
  private imageTexture: THREE.Texture | null = null
  private loadToken = 0
  private aspect = 1

  private readonly subjectCamera: THREE.PerspectiveCamera
  private disposed = false

  constructor(
    initialState: CameraAngleState = DEFAULT_CAMERA_ANGLE_STATE,
    options: SubjectBoxOptions = {}
  ) {
    this.state = clampState(initialState)
    this.loadTexture = options.loadTexture ?? loadTextureWithThree
    const labels = options.faceLabels ?? DEFAULT_SUBJECT_FACE_LABELS
    this.group.name = 'CameraAngleSubject'
    this.group.position.set(
      SUBJECT_CENTER.x,
      SUBJECT_CENTER.y,
      SUBJECT_CENTER.z
    )

    this.frontMaterial = new THREE.MeshBasicMaterial({ color: FRONT_COLOR })
    this.faceMaterials = [
      makeFaceMaterial(labels.right),
      makeFaceMaterial(labels.left),
      makeFaceMaterial(labels.top),
      makeFaceMaterial(labels.bottom),
      this.frontMaterial,
      makeFaceMaterial(labels.back)
    ]

    const geometry = this.buildGeometry()
    this.box = new THREE.Mesh(geometry, this.faceMaterials)
    this.edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({
        color: EDGE_COLOR,
        transparent: true,
        opacity: 0.6
      })
    )
    this.group.add(this.box)
    this.group.add(this.edges)

    this.subjectCamera = new THREE.PerspectiveCamera(
      CAMERA_ANGLE_FOV,
      1,
      SUBJECT_CAMERA_NEAR,
      SUBJECT_CAMERA_FAR
    )
    this.subjectCamera.name = 'CameraAngleSubjectCamera'
    this.placeSubjectCamera()
  }

  attach(scene: THREE.Scene): void {
    this.scene = scene
    scene.add(this.group)
    scene.add(this.subjectCamera)
  }

  detach(): void {
    if (!this.scene) return
    this.scene.remove(this.group)
    this.scene.remove(this.subjectCamera)
    this.scene = null
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.loadToken++
    this.detach()
    this.box.geometry.dispose()
    this.edges.geometry.dispose()
    ;(this.edges.material as THREE.Material).dispose()
    this.applyTexture(null)
    for (const material of new Set(this.faceMaterials)) {
      material.map?.dispose()
      material.dispose()
    }
  }

  getSubjectCamera(): THREE.PerspectiveCamera {
    return this.subjectCamera
  }

  getState(): CameraAngleState {
    return { ...this.state }
  }

  getAspect(): number {
    return this.aspect
  }

  hasImage(): boolean {
    return this.imageTexture !== null
  }

  applyState(next: CameraAngleState): void {
    this.state = clampState(next)
    this.placeSubjectCamera()
  }

  async setImage(url: string | null): Promise<boolean> {
    const token = ++this.loadToken
    if (!url) {
      this.applyTexture(null)
      return true
    }
    let texture: THREE.Texture
    try {
      texture = await this.loadTexture(url)
    } catch {
      return false
    }
    if (token !== this.loadToken || this.disposed) {
      texture.dispose()
      return false
    }
    texture.colorSpace = THREE.SRGBColorSpace
    centerCropToSquare(texture)
    this.applyTexture(texture)
    return true
  }

  private applyTexture(texture: THREE.Texture | null): void {
    this.imageTexture?.dispose()
    this.imageTexture = texture
    this.aspect = texture ? textureAspect(texture) : 1
    this.frontMaterial.map = texture
    this.frontMaterial.color.set(texture ? 0xffffff : FRONT_COLOR)
    this.frontMaterial.needsUpdate = true
  }

  private buildGeometry(): THREE.BoxGeometry {
    return new THREE.BoxGeometry(SUBJECT_HEIGHT, SUBJECT_HEIGHT, SUBJECT_HEIGHT)
  }

  private placeSubjectCamera(): void {
    const { position, quaternion } = computeSubjectTransform(
      toOrbitCameraInfoState(this.state)
    )
    this.subjectCamera.position.copy(position)
    this.subjectCamera.quaternion.copy(quaternion)
    this.subjectCamera.updateMatrixWorld(true)
  }
}
