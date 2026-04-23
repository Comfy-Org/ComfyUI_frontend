import * as THREE from 'three'
import { vi } from 'vitest'

import type { ModelAdapterCapabilities } from '@/extensions/core/load3d/ModelAdapter'
import type {
  CameraState,
  CameraType,
  GizmoMode,
  MaterialMode
} from '@/extensions/core/load3d/interfaces'

export function makeGizmoStub() {
  return {
    setEnabled: vi.fn(),
    setMode: vi.fn(),
    reset: vi.fn(),
    applyTransform: vi.fn(),
    getTransform: vi.fn(() => ({
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    })),
    setupForModel: vi.fn(),
    updateCamera: vi.fn(),
    detach: vi.fn(),
    dispose: vi.fn(),
    removeFromScene: vi.fn(),
    ensureHelperInScene: vi.fn(),
    isEnabled: vi.fn(() => false),
    getMode: vi.fn(() => 'translate' as GizmoMode)
  }
}

export function makeSceneManagerStub() {
  return {
    captureScene: vi.fn(),
    dispose: vi.fn(),
    setBackgroundColor: vi.fn(),
    setBackgroundImage: vi.fn().mockResolvedValue(undefined),
    removeBackgroundImage: vi.fn(),
    toggleGrid: vi.fn(),
    setBackgroundRenderMode: vi.fn(),
    handleResize: vi.fn(),
    renderBackground: vi.fn(),
    updateBackgroundSize: vi.fn(),
    scene: new THREE.Scene(),
    backgroundTexture: null as unknown,
    backgroundMesh: null as unknown,
    gridHelper: { visible: true }
  }
}

export function makeCameraManagerStub() {
  const perspective = new THREE.PerspectiveCamera()
  return {
    activeCamera: perspective as THREE.Camera,
    perspectiveCamera: perspective,
    toggleCamera: vi.fn(),
    setupForModel: vi.fn(),
    reset: vi.fn(),
    setFOV: vi.fn(),
    setCameraState: vi.fn(),
    getCameraState: vi.fn<() => CameraState>(() => ({
      position: new THREE.Vector3(0, 0, 10),
      target: new THREE.Vector3(0, 0, 0),
      zoom: 1,
      cameraType: 'perspective'
    })),
    getCurrentCameraType: vi.fn<() => CameraType>(() => 'perspective'),
    handleResize: vi.fn(),
    updateAspectRatio: vi.fn(),
    dispose: vi.fn()
  }
}

export function makeControlsManagerStub() {
  return {
    controls: {
      target: new THREE.Vector3(0, 0, 0),
      update: vi.fn()
    },
    update: vi.fn(),
    updateCamera: vi.fn(),
    reset: vi.fn(),
    dispose: vi.fn()
  }
}

export function makeLightingManagerStub() {
  return {
    setLightIntensity: vi.fn(),
    setHDRIMode: vi.fn(),
    dispose: vi.fn()
  }
}

export function makeHDRIManagerStub() {
  return {
    loadHDRI: vi.fn().mockResolvedValue(undefined),
    setEnabled: vi.fn(),
    setShowAsBackground: vi.fn(),
    setIntensity: vi.fn(),
    clear: vi.fn(),
    dispose: vi.fn()
  }
}

export function makeViewHelperManagerStub() {
  return {
    viewHelper: { render: vi.fn() },
    recreateViewHelper: vi.fn(),
    visibleViewHelper: vi.fn(),
    update: vi.fn(),
    dispose: vi.fn()
  }
}

export function makeLoaderManagerStub(
  capabilities: ModelAdapterCapabilities | null = {
    fitToViewer: true,
    requiresMaterialRebuild: false,
    gizmoTransform: true,
    lighting: true,
    exportable: true,
    materialModes: ['original', 'normal', 'wireframe']
  },
  kind: 'mesh' | 'pointCloud' | 'splat' | null = 'mesh'
) {
  const adapter =
    kind === null || capabilities === null
      ? null
      : { kind, extensions: [], capabilities, load: vi.fn() }
  return {
    loadModel: vi.fn().mockResolvedValue(undefined),
    getCurrentAdapter: vi.fn(() => adapter),
    init: vi.fn(),
    dispose: vi.fn()
  }
}

type ModelManagerStub = {
  fitToViewer: ReturnType<typeof vi.fn>
  clearModel: ReturnType<typeof vi.fn>
  setMaterialMode: ReturnType<typeof vi.fn>
  setUpDirection: ReturnType<typeof vi.fn>
  setShowSkeleton: ReturnType<typeof vi.fn>
  hasSkeleton: ReturnType<typeof vi.fn<() => boolean>>
  showSkeleton: boolean
  currentModel: THREE.Object3D | null
  originalModel: unknown
  originalFileName: string | null
  originalURL: string | null
  dispose: ReturnType<typeof vi.fn>
  setupModel: ReturnType<typeof vi.fn>
  setOriginalModel: ReturnType<typeof vi.fn>
  originalMaterials: WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]>
  standardMaterial: THREE.MeshStandardMaterial
  materialMode: MaterialMode
}

export function makeModelManagerStub(): ModelManagerStub {
  return {
    fitToViewer: vi.fn(),
    clearModel: vi.fn(),
    setMaterialMode: vi.fn(),
    setUpDirection: vi.fn(),
    setShowSkeleton: vi.fn(),
    hasSkeleton: vi.fn(() => false),
    showSkeleton: false,
    currentModel: null,
    originalModel: null,
    originalFileName: 'model',
    originalURL: null,
    dispose: vi.fn(),
    setupModel: vi.fn().mockResolvedValue(undefined),
    setOriginalModel: vi.fn(),
    originalMaterials: new WeakMap(),
    standardMaterial: new THREE.MeshStandardMaterial(),
    materialMode: 'original'
  }
}

export function makeRecordingManagerStub() {
  return {
    startRecording: vi.fn().mockResolvedValue(undefined),
    stopRecording: vi.fn(),
    getIsRecording: vi.fn(() => false),
    getRecordingDuration: vi.fn(() => 0),
    getRecordingData: vi.fn<() => string | null>(() => null),
    exportRecording: vi.fn(),
    clearRecording: vi.fn(),
    dispose: vi.fn()
  }
}

type AnimationManagerStub = {
  setupModelAnimations: ReturnType<typeof vi.fn>
  setAnimationSpeed: ReturnType<typeof vi.fn>
  updateSelectedAnimation: ReturnType<typeof vi.fn>
  toggleAnimation: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  animationClips: THREE.AnimationClip[]
  isAnimationPlaying: boolean
  getAnimationTime: ReturnType<typeof vi.fn<() => number>>
  getAnimationDuration: ReturnType<typeof vi.fn<() => number>>
  setAnimationTime: ReturnType<typeof vi.fn>
  init: ReturnType<typeof vi.fn>
  dispose: ReturnType<typeof vi.fn>
}

export function makeAnimationManagerStub(): AnimationManagerStub {
  return {
    setupModelAnimations: vi.fn(),
    setAnimationSpeed: vi.fn(),
    updateSelectedAnimation: vi.fn(),
    toggleAnimation: vi.fn(),
    update: vi.fn(),
    animationClips: [],
    isAnimationPlaying: false,
    getAnimationTime: vi.fn(() => 0),
    getAnimationDuration: vi.fn(() => 0),
    setAnimationTime: vi.fn(),
    init: vi.fn(),
    dispose: vi.fn()
  }
}

export function makeEventManagerStub() {
  return {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    emitEvent: vi.fn()
  }
}

// jsdom/happy-dom report 0 for clientWidth/Height; override with deterministic
// values so viewport-sensitive code (renderMainScene, handleResize) is testable.
export function makeRendererStub(containerWidth = 800, containerHeight = 600) {
  const canvas = document.createElement('canvas')
  const parent = document.createElement('div')
  parent.appendChild(canvas)

  const setClientSize = (el: HTMLElement, width: number, height: number) => {
    Object.defineProperty(el, 'clientWidth', {
      value: width,
      configurable: true
    })
    Object.defineProperty(el, 'clientHeight', {
      value: height,
      configurable: true
    })
  }
  setClientSize(parent, containerWidth, containerHeight)
  setClientSize(canvas, containerWidth, containerHeight)

  return {
    domElement: canvas,
    setViewport: vi.fn(),
    setScissor: vi.fn(),
    setScissorTest: vi.fn(),
    setClearColor: vi.fn(),
    setSize: vi.fn(),
    clear: vi.fn(),
    render: vi.fn(),
    forceContextLoss: vi.fn(),
    dispose: vi.fn(),
    parent
  }
}
