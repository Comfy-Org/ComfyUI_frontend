import * as THREE from 'three'

import type { SceneOverlay } from '@/extensions/core/load3d/interfaces'

import { computeSubjectTransform } from './cameraTransform'
import { DEFAULT_CAMERA_INFO_STATE } from './types'
import type { CameraInfoCameraType, CameraInfoState } from './types'

const REFERENCE_CUBE_SIZE = 1
const SUBJECT_CAMERA_NEAR = 0.1
const SUBJECT_CAMERA_FAR = 1000
const ORTHO_FRUSTUM_HALF = 1

export class CameraInfoOverlay implements SceneOverlay {
  private scene: THREE.Scene | null = null
  private state: CameraInfoState

  private readonly subjectPerspective: THREE.PerspectiveCamera
  private readonly subjectOrthographic: THREE.OrthographicCamera
  private subjectCamera: THREE.Camera
  private cameraHelper: THREE.CameraHelper | null = null

  private readonly referenceGroup: THREE.Group
  private readonly referenceCube: THREE.Mesh
  private readonly referenceCubeEdges: THREE.LineSegments
  private readonly axesHelper: THREE.AxesHelper

  private renderCamera: THREE.Camera | null = null
  private disposed = false

  constructor(initialState: CameraInfoState = DEFAULT_CAMERA_INFO_STATE) {
    this.state = cloneState(initialState)

    this.subjectPerspective = new THREE.PerspectiveCamera(
      this.state.fov,
      1,
      SUBJECT_CAMERA_NEAR,
      SUBJECT_CAMERA_FAR
    )
    this.subjectOrthographic = new THREE.OrthographicCamera(
      -ORTHO_FRUSTUM_HALF,
      ORTHO_FRUSTUM_HALF,
      ORTHO_FRUSTUM_HALF,
      -ORTHO_FRUSTUM_HALF,
      SUBJECT_CAMERA_NEAR,
      SUBJECT_CAMERA_FAR
    )
    this.subjectCamera = this.subjectCameraFor(this.state.cameraType)

    const cubeGeometry = new THREE.BoxGeometry(
      REFERENCE_CUBE_SIZE,
      REFERENCE_CUBE_SIZE,
      REFERENCE_CUBE_SIZE
    )
    this.referenceCube = new THREE.Mesh(
      cubeGeometry,
      new THREE.MeshStandardMaterial({
        color: 0xb8bcc4,
        roughness: 0.55,
        metalness: 0.15
      })
    )
    this.referenceCube.position.set(0, REFERENCE_CUBE_SIZE / 2, 0)

    this.referenceCubeEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(cubeGeometry),
      new THREE.LineBasicMaterial({
        color: 0x1a1a1a,
        transparent: true,
        opacity: 0.4
      })
    )
    this.referenceCube.add(this.referenceCubeEdges)

    this.axesHelper = new THREE.AxesHelper(REFERENCE_CUBE_SIZE * 1.25)

    this.referenceGroup = new THREE.Group()
    this.referenceGroup.name = 'CameraInfoReference'
    this.referenceGroup.add(this.referenceCube)
    this.referenceGroup.add(this.axesHelper)
  }

  attach(scene: THREE.Scene): void {
    this.scene = scene
    scene.add(this.referenceGroup)
    scene.add(this.subjectPerspective)
    scene.add(this.subjectOrthographic)
    this.rebuildCameraHelper()
    this.applyStateToScene()
  }

  detach(): void {
    if (!this.scene) return
    this.scene.remove(this.referenceGroup)
    this.scene.remove(this.subjectPerspective)
    this.scene.remove(this.subjectOrthographic)
    if (this.cameraHelper) this.scene.remove(this.cameraHelper)
    this.scene = null
  }

  update(_delta: number): void {
    this.cameraHelper?.update()
  }

  onActiveCameraChange(camera: THREE.Camera): void {
    this.renderCamera = camera
    this.refreshHelperVisibility()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.disposeCameraHelper()
    this.detach()
    this.referenceCube.geometry.dispose()
    ;(this.referenceCube.material as THREE.Material).dispose()
    this.referenceCubeEdges.geometry.dispose()
    ;(this.referenceCubeEdges.material as THREE.Material).dispose()
    this.axesHelper.dispose()
  }

  getSubjectCamera(): THREE.Camera {
    return this.subjectCamera
  }

  setHelperVisible(visible: boolean): void {
    if (this.cameraHelper) this.cameraHelper.visible = visible
  }

  getState(): CameraInfoState {
    return cloneState(this.state)
  }

  applyState(next: CameraInfoState): void {
    const cameraTypeChanged = next.cameraType !== this.state.cameraType
    const modeChanged = next.mode !== this.state.mode
    this.state = cloneState(next)
    if (cameraTypeChanged) {
      this.subjectCamera = this.subjectCameraFor(this.state.cameraType)
      this.rebuildCameraHelper()
    }
    this.applyStateToScene()
    if (modeChanged || cameraTypeChanged) this.refreshHelperVisibility()
  }

  private applyStateToScene(): void {
    const { position, quaternion } = computeSubjectTransform(this.state)
    this.subjectCamera.position.copy(position)
    this.subjectCamera.quaternion.copy(quaternion)
    this.subjectCamera.updateMatrixWorld(true)

    if (this.subjectCamera instanceof THREE.PerspectiveCamera) {
      this.subjectCamera.fov = this.state.fov
      this.subjectCamera.zoom = this.state.zoom
      this.subjectCamera.updateProjectionMatrix()
    } else if (this.subjectCamera instanceof THREE.OrthographicCamera) {
      this.subjectCamera.zoom = this.state.zoom
      this.subjectCamera.updateProjectionMatrix()
    }

    this.cameraHelper?.update()
  }

  private subjectCameraFor(type: CameraInfoCameraType): THREE.Camera {
    return type === 'perspective'
      ? this.subjectPerspective
      : this.subjectOrthographic
  }

  private rebuildCameraHelper(): void {
    this.disposeCameraHelper()
    if (!this.scene) return
    this.cameraHelper = new THREE.CameraHelper(this.subjectCamera)
    this.scene.add(this.cameraHelper)
    this.refreshHelperVisibility()
  }

  private disposeCameraHelper(): void {
    if (!this.cameraHelper) return
    if (this.scene) this.scene.remove(this.cameraHelper)
    this.cameraHelper.geometry.dispose()
    const material = this.cameraHelper.material as
      | THREE.Material
      | THREE.Material[]
    if (Array.isArray(material)) material.forEach((m) => m.dispose())
    else material.dispose()
    this.cameraHelper = null
  }

  private refreshHelperVisibility(): void {
    if (!this.cameraHelper) return
    this.cameraHelper.visible = this.renderCamera !== this.subjectCamera
  }
}

function cloneState(state: CameraInfoState): CameraInfoState {
  return {
    mode: state.mode,
    target: { ...state.target },
    roll: state.roll,
    fov: state.fov,
    zoom: state.zoom,
    cameraType: state.cameraType,
    orbit: { ...state.orbit },
    lookAt: { position: { ...state.lookAt.position } },
    quaternion: {
      position: { ...state.quaternion.position },
      quat: { ...state.quaternion.quat }
    }
  }
}
