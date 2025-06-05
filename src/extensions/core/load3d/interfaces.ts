import { LGraphNode } from '@comfyorg/litegraph'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { ViewHelper } from 'three/examples/jsm/helpers/ViewHelper'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader'
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader'

import { CustomInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

export type Load3DNodeType = 'Load3D' | 'Preview3D'

export type Load3DAnimationNodeType = 'Load3DAnimation' | 'Preview3DAnimation'

export type MaterialMode =
  | 'original'
  | 'normal'
  | 'wireframe'
  | 'depth'
  | 'lineart'
export type UpDirection = 'original' | '-x' | '+x' | '-y' | '+y' | '-z' | '+z'
export type CameraType = 'perspective' | 'orthographic'

export interface CameraState {
  position: THREE.Vector3
  target: THREE.Vector3
  zoom: number
  cameraType: CameraType
}

export interface EventCallback {
  (data?: any): void
}

export interface Load3DOptions {
  node?: LGraphNode
  inputSpec?: CustomInputSpec
}

export interface CaptureResult {
  scene: string
  mask: string
  normal: string
  lineart: string
}

export interface BaseManager {
  init(): void
  dispose(): void
  reset(): void
}

export interface AnimationItem {
  name: string
  index: number
}

export interface SceneManagerInterface extends BaseManager {
  scene: THREE.Scene
  gridHelper: THREE.GridHelper
  toggleGrid(showGrid: boolean): void
  setBackgroundColor(color: string): void
  setBackgroundImage(uploadPath: string): Promise<void>
  removeBackgroundImage(): void
  handleResize(width: number, height: number): void
  captureScene(width: number, height: number): Promise<CaptureResult>
}

export interface CameraManagerInterface extends BaseManager {
  activeCamera: THREE.Camera
  perspectiveCamera: THREE.PerspectiveCamera
  orthographicCamera: THREE.OrthographicCamera
  getCurrentCameraType(): CameraType
  toggleCamera(cameraType?: CameraType): void
  setFOV(fov: number): void
  setCameraState(state: CameraState): void
  getCameraState(): CameraState
  handleResize(width: number, height: number): void
  setControls(controls: OrbitControls): void
}

export interface ControlsManagerInterface extends BaseManager {
  controls: OrbitControls
  handleResize(): void
}

export interface LightingManagerInterface extends BaseManager {
  lights: THREE.Light[]
  setLightIntensity(intensity: number): void
}

export interface ViewHelperManagerInterface extends BaseManager {
  viewHelper: ViewHelper
  viewHelperContainer: HTMLDivElement
  createViewHelper(container: Element | HTMLElement): void
  update(delta: number): void
  handleResize(): void
}

export interface PreviewManagerInterface extends BaseManager {
  previewCamera: THREE.Camera
  previewContainer: HTMLDivElement
  showPreview: boolean
  previewWidth: number
  createCapturePreview(container: Element | HTMLElement): void
  updatePreviewSize(): void
  updatePreviewRender(): void
  togglePreview(showPreview: boolean): void
  setTargetSize(width: number, height: number): void
  handleResize(): void
  updateBackgroundTexture(texture: THREE.Texture | null): void
  getPreviewViewport(): {
    left: number
    bottom: number
    width: number
    height: number
  } | null
  renderPreview(): void
  syncWithMainCamera(): void
}

export interface EventManagerInterface {
  addEventListener(event: string, callback: EventCallback): void
  removeEventListener(event: string, callback: EventCallback): void
  emitEvent(event: string, data?: any): void
}

export interface NodeStorageInterface {
  storeNodeProperty(name: string, value: any): void
  loadNodeProperty(name: string, defaultValue: any): any
}

export interface AnimationManagerInterface extends BaseManager {
  currentAnimation: THREE.AnimationMixer | null
  animationActions: THREE.AnimationAction[]
  animationClips: THREE.AnimationClip[]
  selectedAnimationIndex: number
  isAnimationPlaying: boolean
  animationSpeed: number

  setupModelAnimations(model: THREE.Object3D, originalModel: any): void
  updateAnimationList(): void
  setAnimationSpeed(speed: number): void
  updateSelectedAnimation(index: number): void
  toggleAnimation(play?: boolean): void
  update(delta: number): void
}

export interface ModelManagerInterface {
  originalFileName: string | null
  originalURL: string | null
  currentModel: THREE.Object3D | null
  originalModel: THREE.Object3D | THREE.BufferGeometry | GLTF | null
  originalRotation: THREE.Euler | null
  currentUpDirection: UpDirection

  init(): void
  dispose(): void
  clearModel(): void
  reset(): void
  setupModel(model: THREE.Object3D): Promise<void>
  setOriginalModel(model: THREE.Object3D | THREE.BufferGeometry | GLTF): void
  setUpDirection(direction: UpDirection): void
  materialMode: MaterialMode
  originalMaterials: WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]>
  normalMaterial: THREE.MeshNormalMaterial
  standardMaterial: THREE.MeshStandardMaterial
  wireframeMaterial: THREE.MeshBasicMaterial
  depthMaterial: THREE.MeshDepthMaterial
  setMaterialMode(mode: MaterialMode): void
  setupModelMaterials(model: THREE.Object3D): void
}

export interface LoaderManagerInterface {
  gltfLoader: GLTFLoader
  objLoader: OBJLoader
  mtlLoader: MTLLoader
  fbxLoader: FBXLoader
  stlLoader: STLLoader

  init(): void
  dispose(): void
  loadModel(url: string, originalFileName?: string): Promise<void>
}

export interface RecordingManagerInterface extends BaseManager {
  startRecording(): Promise<void>
  stopRecording(): void
  hasRecording(): boolean
  getRecordingDuration(): number
  exportRecording(filename?: string): void
  clearRecording(): void
}
