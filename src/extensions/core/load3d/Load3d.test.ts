import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock all sub-managers as classes (vi.fn().mockImplementation won't work as constructors)
vi.mock('./SceneManager', () => {
  class MockSceneManager {
    scene = { add: vi.fn(), remove: vi.fn(), traverse: vi.fn(), clear: vi.fn() }
    gridHelper = { visible: true, position: { set: vi.fn() } }
    backgroundTexture = null
    backgroundMesh = null
    init = vi.fn()
    dispose = vi.fn()
    reset = vi.fn()
    toggleGrid = vi.fn()
    setBackgroundColor = vi.fn()
    setBackgroundImage = vi.fn().mockResolvedValue(undefined)
    removeBackgroundImage = vi.fn()
    setBackgroundRenderMode = vi.fn()
    handleResize = vi.fn()
    renderBackground = vi.fn()
    captureScene = vi.fn().mockResolvedValue({
      scene: 'data:scene',
      mask: 'data:mask',
      normal: 'data:normal'
    })
    updateBackgroundSize = vi.fn()
  }
  return { SceneManager: MockSceneManager }
})

vi.mock('./CameraManager', () => {
  class MockCameraManager {
    activeCamera = {
      position: {
        set: vi.fn(),
        clone: vi.fn().mockReturnValue({ x: 0, y: 0, z: 0 }),
        copy: vi.fn()
      },
      rotation: { clone: vi.fn(), copy: vi.fn() },
      zoom: 1
    }
    perspectiveCamera = {
      position: {
        set: vi.fn(),
        clone: vi.fn().mockReturnValue({ x: 0, y: 0, z: 0 }),
        copy: vi.fn()
      },
      lookAt: vi.fn(),
      updateProjectionMatrix: vi.fn(),
      aspect: 1,
      fov: 35
    }
    orthographicCamera = {
      position: { set: vi.fn(), clone: vi.fn(), copy: vi.fn() }
    }
    init = vi.fn()
    dispose = vi.fn()
    reset = vi.fn()
    setControls = vi.fn()
    getCurrentCameraType = vi.fn().mockReturnValue('perspective')
    toggleCamera = vi.fn()
    setFOV = vi.fn()
    setCameraState = vi.fn()
    getCameraState = vi.fn().mockReturnValue({
      position: { x: 10, y: 10, z: 10 },
      target: { x: 0, y: 0, z: 0 },
      zoom: 1,
      cameraType: 'perspective'
    })
    handleResize = vi.fn()
    updateAspectRatio = vi.fn()
    setupForModel = vi.fn()
  }
  return { CameraManager: MockCameraManager }
})

vi.mock('./ControlsManager', () => {
  class MockControlsManager {
    controls = {
      target: {
        set: vi.fn(),
        clone: vi.fn().mockReturnValue({ x: 0, y: 0, z: 0 }),
        copy: vi.fn()
      },
      update: vi.fn(),
      dispose: vi.fn(),
      object: {}
    }
    init = vi.fn()
    dispose = vi.fn()
    reset = vi.fn()
    update = vi.fn()
    updateCamera = vi.fn()
  }
  return { ControlsManager: MockControlsManager }
})

vi.mock('./LightingManager', () => {
  class MockLightingManager {
    lights: never[] = []
    init = vi.fn()
    dispose = vi.fn()
    reset = vi.fn()
    setLightIntensity = vi.fn()
  }
  return { LightingManager: MockLightingManager }
})

vi.mock('./ViewHelperManager', () => {
  class MockViewHelperManager {
    viewHelper = {
      render: vi.fn(),
      update: vi.fn(),
      dispose: vi.fn(),
      animating: false,
      visible: true,
      center: null
    }
    viewHelperContainer = document.createElement('div')
    init = vi.fn()
    dispose = vi.fn()
    reset = vi.fn()
    createViewHelper = vi.fn()
    update = vi.fn()
    handleResize = vi.fn()
    visibleViewHelper = vi.fn()
    recreateViewHelper = vi.fn()
  }
  return { ViewHelperManager: MockViewHelperManager }
})

vi.mock('./LoaderManager', () => {
  class MockLoaderManager {
    init = vi.fn()
    dispose = vi.fn()
    loadModel = vi.fn().mockResolvedValue(undefined)
  }
  return { LoaderManager: MockLoaderManager }
})

vi.mock('./SceneModelManager', () => {
  class MockSceneModelManager {
    currentModel = null
    originalModel = null
    originalFileName: string | null = null
    originalURL: string | null = null
    originalRotation = null
    currentUpDirection = 'original'
    materialMode = 'original'
    showSkeleton = false
    originalMaterials = new WeakMap()
    normalMaterial = {}
    standardMaterial = {}
    wireframeMaterial = {}
    depthMaterial = {}
    init = vi.fn()
    dispose = vi.fn()
    reset = vi.fn()
    clearModel = vi.fn()
    setupModel = vi.fn()
    addModelToScene = vi.fn()
    setOriginalModel = vi.fn()
    setUpDirection = vi.fn()
    setMaterialMode = vi.fn()
    setupModelMaterials = vi.fn()
    hasSkeleton = vi.fn().mockReturnValue(false)
    setShowSkeleton = vi.fn()
    containsSplatMesh = vi.fn().mockReturnValue(false)
  }
  return { SceneModelManager: MockSceneModelManager }
})

vi.mock('./RecordingManager', () => {
  class MockRecordingManager {
    init = vi.fn()
    dispose = vi.fn()
    reset = vi.fn()
    startRecording = vi.fn().mockResolvedValue(undefined)
    stopRecording = vi.fn()
    getIsRecording = vi.fn().mockReturnValue(false)
    getRecordingDuration = vi.fn().mockReturnValue(0)
    getRecordingData = vi.fn().mockReturnValue(null)
    exportRecording = vi.fn()
    clearRecording = vi.fn()
  }
  return { RecordingManager: MockRecordingManager }
})

vi.mock('./AnimationManager', () => {
  class MockAnimationManager {
    animationClips: never[] = []
    animationActions: never[] = []
    isAnimationPlaying = false
    currentAnimation = null
    selectedAnimationIndex = 0
    animationSpeed = 1.0
    init = vi.fn()
    dispose = vi.fn()
    reset = vi.fn()
    update = vi.fn()
    setupModelAnimations = vi.fn()
    setAnimationSpeed = vi.fn()
    updateSelectedAnimation = vi.fn()
    toggleAnimation = vi.fn()
    getAnimationTime = vi.fn().mockReturnValue(0)
    getAnimationDuration = vi.fn().mockReturnValue(0)
    setAnimationTime = vi.fn()
  }
  return { AnimationManager: MockAnimationManager }
})

vi.mock('./ModelExporter', () => ({
  ModelExporter: {
    exportGLB: vi.fn().mockResolvedValue(undefined),
    exportOBJ: vi.fn().mockResolvedValue(undefined),
    exportSTL: vi.fn().mockResolvedValue(undefined)
  }
}))

// Mock THREE.js — only the parts Load3d itself uses directly
vi.mock('three', () => {
  const mockDomElement = document.createElement('canvas')
  Object.defineProperty(mockDomElement, 'clientWidth', {
    value: 800,
    configurable: true
  })
  Object.defineProperty(mockDomElement, 'clientHeight', {
    value: 600,
    configurable: true
  })

  class MockWebGLRenderer {
    domElement = mockDomElement
    autoClear = false
    outputColorSpace = ''
    toneMapping = 0
    toneMappingExposure = 1
    setSize = vi.fn()
    setClearColor = vi.fn()
    getClearColor = vi.fn()
    getClearAlpha = vi.fn().mockReturnValue(1)
    setViewport = vi.fn()
    setScissor = vi.fn()
    setScissorTest = vi.fn()
    clear = vi.fn()
    render = vi.fn()
    dispose = vi.fn()
    forceContextLoss = vi.fn()
  }

  class MockClock {
    getDelta = vi.fn().mockReturnValue(0.016)
  }

  class MockVector3 {
    x: number
    y: number
    z: number
    constructor(x = 0, y = 0, z = 0) {
      this.x = x
      this.y = y
      this.z = z
    }
    clone() {
      return new MockVector3(this.x, this.y, this.z)
    }
    copy(v: MockVector3) {
      this.x = v.x
      this.y = v.y
      this.z = v.z
      return this
    }
    set(x: number, y: number, z: number) {
      this.x = x
      this.y = y
      this.z = z
      return this
    }
  }

  class MockBox3 {
    min = new MockVector3()
    setFromObject() {
      return this
    }
    getSize(v: MockVector3) {
      v.x = 1
      v.y = 1
      v.z = 1
      return v
    }
    getCenter(v: MockVector3) {
      v.x = 0
      v.y = 0
      v.z = 0
      return v
    }
  }

  return {
    WebGLRenderer: MockWebGLRenderer,
    Clock: MockClock,
    Vector3: MockVector3,
    Box3: MockBox3,
    SRGBColorSpace: 'srgb',
    // Needed by sub-manager mocks at import time
    Scene: vi.fn(),
    PerspectiveCamera: vi.fn(),
    OrthographicCamera: vi.fn(),
    GridHelper: vi.fn(),
    Color: vi.fn(),
    BufferGeometry: vi.fn()
  }
})

vi.mock('three/examples/jsm/controls/OrbitControls', () => ({
  OrbitControls: vi.fn()
}))

vi.mock('three/examples/jsm/helpers/ViewHelper', () => ({
  ViewHelper: vi.fn()
}))

// Indirect dependencies pulled in by mocked modules
vi.mock('@/i18n', () => ({ t: vi.fn((key: string) => key) }))
vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn().mockReturnValue({ get: vi.fn() })
}))
vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: vi.fn().mockReturnValue({ addAlert: vi.fn() })
}))
vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: vi.fn(),
    apiURL: vi.fn((p: string) => p),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
}))
vi.mock('@/scripts/app', () => ({
  app: { getRandParam: vi.fn().mockReturnValue('&rand=1'), canvas: null }
}))
vi.mock('@/scripts/metadata/ply', () => ({
  isPLYAsciiFormat: vi.fn().mockReturnValue(false)
}))
vi.mock('@/base/common/downloadUtil', () => ({ downloadBlob: vi.fn() }))

import * as THREE from 'three'

import Load3d from './Load3d'
import type { CameraState } from './interfaces'

function createContainer(): HTMLDivElement {
  const el = document.createElement('div')
  Object.defineProperty(el, 'clientWidth', { value: 800 })
  Object.defineProperty(el, 'clientHeight', { value: 600 })
  document.body.appendChild(el)
  return el
}

describe('Load3d', () => {
  let load3d: Load3d
  let container: HTMLDivElement

  // Extra instances created in tests — tracked for cleanup
  const extraInstances: Load3d[] = []

  function createInstance(
    options?: ConstructorParameters<typeof Load3d>[1]
  ): Load3d {
    const instance = new Load3d(container, options)
    vi.advanceTimersByTime(150)
    extraInstances.push(instance)
    return instance
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    container = createContainer()
    load3d = new Load3d(container)
    vi.advanceTimersByTime(150)
  })

  afterEach(() => {
    extraInstances.forEach((i) => i.remove())
    extraInstances.length = 0
    vi.useRealTimers()
    load3d.remove()
    container.remove()
  })

  describe('constructor', () => {
    it('appends the renderer canvas to the container', () => {
      expect(container.querySelector('canvas')).not.toBeNull()
    })

    it('sets target dimensions from options', () => {
      const sized = createInstance({ width: 1024, height: 768 })
      expect(sized.targetWidth).toBe(1024)
      expect(sized.targetHeight).toBe(768)
      expect(sized.targetAspectRatio).toBeCloseTo(1024 / 768)
    })

    it('sets viewer mode from options', () => {
      const viewer = createInstance({ isViewerMode: true })
      expect(viewer.isViewerMode).toBe(true)
    })
  })

  describe('isActive', () => {
    it('returns false when no activity flags are set and initial render is done', () => {
      load3d.INITIAL_RENDER_DONE = true
      load3d.STATUS_MOUSE_ON_NODE = false
      load3d.STATUS_MOUSE_ON_SCENE = false
      load3d.STATUS_MOUSE_ON_VIEWER = false
      expect(load3d.isActive()).toBe(false)
    })

    it('returns true when mouse is on node', () => {
      load3d.INITIAL_RENDER_DONE = true
      load3d.STATUS_MOUSE_ON_NODE = true
      expect(load3d.isActive()).toBe(true)
    })

    it('returns true when mouse is on scene', () => {
      load3d.INITIAL_RENDER_DONE = true
      load3d.STATUS_MOUSE_ON_SCENE = true
      expect(load3d.isActive()).toBe(true)
    })

    it('returns true when mouse is on viewer', () => {
      load3d.INITIAL_RENDER_DONE = true
      load3d.STATUS_MOUSE_ON_VIEWER = true
      expect(load3d.isActive()).toBe(true)
    })

    it('returns true before initial render is done', () => {
      load3d.INITIAL_RENDER_DONE = false
      expect(load3d.isActive()).toBe(true)
    })

    it('returns true when animation is playing', () => {
      load3d.INITIAL_RENDER_DONE = true
      load3d.animationManager.isAnimationPlaying = true
      expect(load3d.isActive()).toBe(true)
    })

    it('returns true when recording is active', () => {
      load3d.INITIAL_RENDER_DONE = true
      vi.mocked(load3d.recordingManager.getIsRecording).mockReturnValue(true)
      expect(load3d.isActive()).toBe(true)
    })
  })

  describe('getTargetSize / setTargetSize', () => {
    it('returns current target dimensions', () => {
      load3d.setTargetSize(640, 480)
      expect(load3d.getTargetSize()).toEqual({ width: 640, height: 480 })
    })

    it('updates aspect ratio', () => {
      load3d.setTargetSize(1920, 1080)
      expect(load3d.targetAspectRatio).toBeCloseTo(1920 / 1080)
    })
  })

  describe('addEventListener / removeEventListener', () => {
    it('delegates to eventManager', () => {
      const callback = vi.fn()
      load3d.addEventListener('test', callback)
      load3d.eventManager.emitEvent('test', 'payload')
      expect(callback).toHaveBeenCalledWith('payload')

      load3d.removeEventListener('test', callback)
      load3d.eventManager.emitEvent('test', 'payload2')
      expect(callback).toHaveBeenCalledTimes(1)
    })
  })

  describe('scene delegation', () => {
    it('toggleGrid delegates and forces render', () => {
      const renderSpy = vi.spyOn(load3d, 'forceRender')
      load3d.toggleGrid(false)
      expect(load3d.sceneManager.toggleGrid).toHaveBeenCalledWith(false)
      expect(renderSpy).toHaveBeenCalled()
    })

    it('setBackgroundColor delegates and forces render', () => {
      const renderSpy = vi.spyOn(load3d, 'forceRender')
      load3d.setBackgroundColor('#ff0000')
      expect(load3d.sceneManager.setBackgroundColor).toHaveBeenCalledWith(
        '#ff0000'
      )
      expect(renderSpy).toHaveBeenCalled()
    })

    it('setBackgroundRenderMode delegates and forces render', () => {
      const renderSpy = vi.spyOn(load3d, 'forceRender')
      load3d.setBackgroundRenderMode('panorama')
      expect(load3d.sceneManager.setBackgroundRenderMode).toHaveBeenCalledWith(
        'panorama'
      )
      expect(renderSpy).toHaveBeenCalled()
    })

    it('removeBackgroundImage delegates and forces render', () => {
      const renderSpy = vi.spyOn(load3d, 'forceRender')
      load3d.removeBackgroundImage()
      expect(load3d.sceneManager.removeBackgroundImage).toHaveBeenCalled()
      expect(renderSpy).toHaveBeenCalled()
    })

    it('captureScene delegates to sceneManager', () => {
      load3d.captureScene(512, 512)
      expect(load3d.sceneManager.captureScene).toHaveBeenCalledWith(512, 512)
    })
  })

  describe('camera delegation', () => {
    it('toggleCamera delegates and updates controls and viewHelper', () => {
      load3d.toggleCamera('orthographic')
      expect(load3d.cameraManager.toggleCamera).toHaveBeenCalledWith(
        'orthographic'
      )
      expect(load3d.controlsManager.updateCamera).toHaveBeenCalled()
      expect(load3d.viewHelperManager.recreateViewHelper).toHaveBeenCalled()
    })

    it('getCurrentCameraType delegates', () => {
      load3d.getCurrentCameraType()
      expect(load3d.cameraManager.getCurrentCameraType).toHaveBeenCalled()
    })

    it('setFOV delegates and forces render', () => {
      const renderSpy = vi.spyOn(load3d, 'forceRender')
      load3d.setFOV(60)
      expect(load3d.cameraManager.setFOV).toHaveBeenCalledWith(60)
      expect(renderSpy).toHaveBeenCalled()
    })

    it('setCameraState delegates and forces render', () => {
      const renderSpy = vi.spyOn(load3d, 'forceRender')
      const state: CameraState = {
        position: new THREE.Vector3(1, 2, 3),
        target: new THREE.Vector3(0, 0, 0),
        zoom: 1,
        cameraType: 'perspective'
      }
      load3d.setCameraState(state)
      expect(load3d.cameraManager.setCameraState).toHaveBeenCalledWith(state)
      expect(renderSpy).toHaveBeenCalled()
    })

    it('getCameraState delegates', () => {
      load3d.getCameraState()
      expect(load3d.cameraManager.getCameraState).toHaveBeenCalled()
    })
  })

  describe('model delegation', () => {
    it('setMaterialMode delegates and forces render', () => {
      const renderSpy = vi.spyOn(load3d, 'forceRender')
      load3d.setMaterialMode('wireframe')
      expect(load3d.modelManager.setMaterialMode).toHaveBeenCalledWith(
        'wireframe'
      )
      expect(renderSpy).toHaveBeenCalled()
    })

    it('setUpDirection delegates and forces render', () => {
      const renderSpy = vi.spyOn(load3d, 'forceRender')
      load3d.setUpDirection('+z')
      expect(load3d.modelManager.setUpDirection).toHaveBeenCalledWith('+z')
      expect(renderSpy).toHaveBeenCalled()
    })

    it('getCurrentModel returns modelManager.currentModel', () => {
      expect(load3d.getCurrentModel()).toBeNull()
    })

    it('isSplatModel delegates to modelManager', () => {
      load3d.isSplatModel()
      expect(load3d.modelManager.containsSplatMesh).toHaveBeenCalled()
    })
  })

  describe('lighting delegation', () => {
    it('setLightIntensity delegates and forces render', () => {
      const renderSpy = vi.spyOn(load3d, 'forceRender')
      load3d.setLightIntensity(5)
      expect(load3d.lightingManager.setLightIntensity).toHaveBeenCalledWith(5)
      expect(renderSpy).toHaveBeenCalled()
    })
  })

  describe('clearModel', () => {
    it('disposes animations and clears model, then renders', () => {
      const renderSpy = vi.spyOn(load3d, 'forceRender')
      load3d.clearModel()
      expect(load3d.animationManager.dispose).toHaveBeenCalled()
      expect(load3d.modelManager.clearModel).toHaveBeenCalled()
      expect(renderSpy).toHaveBeenCalled()
    })
  })

  describe('animation methods', () => {
    it('hasAnimations returns false when empty', () => {
      expect(load3d.hasAnimations()).toBe(false)
    })

    it('hasAnimations returns true when clips exist', () => {
      load3d.animationManager.animationClips = [
        { name: 'clip' } as THREE.AnimationClip
      ]
      expect(load3d.hasAnimations()).toBe(true)
    })

    it('setAnimationSpeed delegates', () => {
      load3d.setAnimationSpeed(2.0)
      expect(load3d.animationManager.setAnimationSpeed).toHaveBeenCalledWith(
        2.0
      )
    })

    it('updateSelectedAnimation delegates', () => {
      load3d.updateSelectedAnimation(1)
      expect(
        load3d.animationManager.updateSelectedAnimation
      ).toHaveBeenCalledWith(1)
    })

    it('toggleAnimation delegates', () => {
      load3d.toggleAnimation(true)
      expect(load3d.animationManager.toggleAnimation).toHaveBeenCalledWith(true)
    })

    it('getAnimationTime delegates', () => {
      load3d.getAnimationTime()
      expect(load3d.animationManager.getAnimationTime).toHaveBeenCalled()
    })

    it('getAnimationDuration delegates', () => {
      load3d.getAnimationDuration()
      expect(load3d.animationManager.getAnimationDuration).toHaveBeenCalled()
    })

    it('setAnimationTime delegates and forces render', () => {
      const renderSpy = vi.spyOn(load3d, 'forceRender')
      load3d.setAnimationTime(0.5)
      expect(load3d.animationManager.setAnimationTime).toHaveBeenCalledWith(0.5)
      expect(renderSpy).toHaveBeenCalled()
    })
  })

  describe('recording methods', () => {
    it('isRecording delegates', () => {
      load3d.isRecording()
      expect(load3d.recordingManager.getIsRecording).toHaveBeenCalled()
    })

    it('getRecordingDuration delegates', () => {
      load3d.getRecordingDuration()
      expect(load3d.recordingManager.getRecordingDuration).toHaveBeenCalled()
    })

    it('getRecordingData delegates', () => {
      load3d.getRecordingData()
      expect(load3d.recordingManager.getRecordingData).toHaveBeenCalled()
    })

    it('exportRecording delegates', () => {
      load3d.exportRecording('test.mp4')
      expect(load3d.recordingManager.exportRecording).toHaveBeenCalledWith(
        'test.mp4'
      )
    })

    it('clearRecording delegates', () => {
      load3d.clearRecording()
      expect(load3d.recordingManager.clearRecording).toHaveBeenCalled()
    })

    it('startRecording hides view helper and delegates', async () => {
      await load3d.startRecording()
      expect(load3d.viewHelperManager.visibleViewHelper).toHaveBeenCalledWith(
        false
      )
      expect(load3d.recordingManager.startRecording).toHaveBeenCalled()
    })

    it('stopRecording shows view helper and emits event', () => {
      const emitSpy = vi.spyOn(load3d.eventManager, 'emitEvent')
      load3d.stopRecording()
      expect(load3d.viewHelperManager.visibleViewHelper).toHaveBeenCalledWith(
        true
      )
      expect(load3d.recordingManager.stopRecording).toHaveBeenCalled()
      expect(emitSpy).toHaveBeenCalledWith('recordingStatusChange', false)
    })
  })

  describe('skeleton methods', () => {
    it('hasSkeleton delegates', () => {
      load3d.hasSkeleton()
      expect(load3d.modelManager.hasSkeleton).toHaveBeenCalled()
    })

    it('setShowSkeleton delegates and forces render', () => {
      const renderSpy = vi.spyOn(load3d, 'forceRender')
      load3d.setShowSkeleton(true)
      expect(load3d.modelManager.setShowSkeleton).toHaveBeenCalledWith(true)
      expect(renderSpy).toHaveBeenCalled()
    })

    it('getShowSkeleton reads modelManager state', () => {
      load3d.modelManager.showSkeleton = true
      expect(load3d.getShowSkeleton()).toBe(true)
    })
  })

  describe('exportModel', () => {
    it('throws when no model is loaded', async () => {
      load3d.modelManager.currentModel = null
      await expect(load3d.exportModel('glb')).rejects.toThrow(
        'No model to export'
      )
    })

    it('throws for unsupported format', async () => {
      load3d.modelManager.currentModel = {
        clone: vi.fn().mockReturnValue({})
      } as unknown as THREE.Object3D
      load3d.modelManager.originalFileName = 'test'
      const promise = load3d.exportModel('xyz')
      // exportModel uses setTimeout(resolve, 10) internally
      vi.advanceTimersByTime(50)
      await expect(promise).rejects.toThrow('Unsupported export format: xyz')
    })

    it('calls correct exporter and emits loading events for glb', async () => {
      load3d.modelManager.currentModel = {
        clone: vi.fn().mockReturnValue({})
      } as unknown as THREE.Object3D
      load3d.modelManager.originalFileName = 'test'

      const { ModelExporter } = await import('./ModelExporter')
      const emitSpy = vi.spyOn(load3d.eventManager, 'emitEvent')
      const promise = load3d.exportModel('glb')
      await vi.advanceTimersByTimeAsync(50)
      await promise

      expect(ModelExporter.exportGLB).toHaveBeenCalled()
      expect(emitSpy).toHaveBeenCalledWith(
        'exportLoadingStart',
        'Exporting as GLB...'
      )
      expect(emitSpy).toHaveBeenCalledWith('exportLoadingEnd', null)
    })
  })

  describe('loadModel', () => {
    it('resets managers and delegates to loaderManager', async () => {
      await load3d.loadModel('http://example.com/model.glb', 'model.glb')

      expect(load3d.cameraManager.reset).toHaveBeenCalled()
      expect(load3d.controlsManager.reset).toHaveBeenCalled()
      expect(load3d.modelManager.clearModel).toHaveBeenCalled()
      expect(load3d.animationManager.dispose).toHaveBeenCalled()
      expect(load3d.loaderManager.loadModel).toHaveBeenCalledWith(
        'http://example.com/model.glb',
        'model.glb'
      )
    })

    it('sets up animations when model has been loaded', async () => {
      const mockModel = {} as unknown as THREE.Object3D
      load3d.modelManager.currentModel = mockModel
      load3d.modelManager.originalModel = {} as unknown as THREE.Object3D

      await load3d.loadModel('http://example.com/model.glb', 'model.glb')

      expect(load3d.animationManager.setupModelAnimations).toHaveBeenCalledWith(
        mockModel,
        load3d.modelManager.originalModel
      )
    })

    it('serializes concurrent loadModel calls', async () => {
      let resolveFirst!: () => void
      const firstPromise = new Promise<void>((r) => {
        resolveFirst = r
      })
      vi.mocked(load3d.loaderManager.loadModel)
        .mockImplementationOnce(() => firstPromise)
        .mockResolvedValueOnce(undefined)

      const p1 = load3d.loadModel('url1')
      const p2 = load3d.loadModel('url2')

      resolveFirst()
      await p1
      await p2

      expect(load3d.loaderManager.loadModel).toHaveBeenCalledTimes(2)
    })
  })

  describe('captureThumbnail', () => {
    it('throws when no model is loaded', async () => {
      load3d.modelManager.currentModel = null
      await expect(load3d.captureThumbnail()).rejects.toThrow(
        'No model loaded for thumbnail capture'
      )
    })
  })

  describe('remove', () => {
    it('disposes all managers and renderer', () => {
      load3d.remove()

      expect(load3d.sceneManager.dispose).toHaveBeenCalled()
      expect(load3d.cameraManager.dispose).toHaveBeenCalled()
      expect(load3d.controlsManager.dispose).toHaveBeenCalled()
      expect(load3d.lightingManager.dispose).toHaveBeenCalled()
      expect(load3d.viewHelperManager.dispose).toHaveBeenCalled()
      expect(load3d.loaderManager.dispose).toHaveBeenCalled()
      expect(load3d.modelManager.dispose).toHaveBeenCalled()
      expect(load3d.recordingManager.dispose).toHaveBeenCalled()
      expect(load3d.animationManager.dispose).toHaveBeenCalled()
    })
  })

  describe('context menu behavior', () => {
    it('calls onContextMenu callback on right-click without drag', () => {
      const contextMenuFn = vi.fn()
      const instance = createInstance({ onContextMenu: contextMenuFn })

      const canvas = instance.renderer.domElement
      canvas.dispatchEvent(
        new MouseEvent('mousedown', { button: 2, clientX: 100, clientY: 100 })
      )
      canvas.dispatchEvent(
        new MouseEvent('contextmenu', {
          clientX: 100,
          clientY: 100,
          cancelable: true,
          bubbles: true
        })
      )

      expect(contextMenuFn).toHaveBeenCalled()
    })

    it('suppresses context menu after right-drag beyond threshold', () => {
      const contextMenuFn = vi.fn()
      const instance = createInstance({ onContextMenu: contextMenuFn })

      const canvas = instance.renderer.domElement
      canvas.dispatchEvent(
        new MouseEvent('mousedown', { button: 2, clientX: 100, clientY: 100 })
      )
      canvas.dispatchEvent(
        new MouseEvent('mousemove', { buttons: 2, clientX: 150, clientY: 150 })
      )
      canvas.dispatchEvent(
        new MouseEvent('contextmenu', {
          clientX: 150,
          clientY: 150,
          cancelable: true,
          bubbles: true
        })
      )

      expect(contextMenuFn).not.toHaveBeenCalled()
    })

    it('does not fire context menu in viewer mode', () => {
      const contextMenuFn = vi.fn()
      const instance = createInstance({
        onContextMenu: contextMenuFn,
        isViewerMode: true
      })

      const canvas = instance.renderer.domElement
      canvas.dispatchEvent(
        new MouseEvent('mousedown', { button: 2, clientX: 100, clientY: 100 })
      )
      canvas.dispatchEvent(
        new MouseEvent('contextmenu', {
          clientX: 100,
          clientY: 100,
          cancelable: true,
          bubbles: true
        })
      )

      expect(contextMenuFn).not.toHaveBeenCalled()
    })
  })

  describe('handleResize with getDimensions callback', () => {
    it('uses getDimensions callback to update target size', () => {
      const getDimensions = vi.fn().mockReturnValue({ width: 400, height: 300 })
      const instance = createInstance({ getDimensions })

      instance.handleResize()

      expect(instance.targetWidth).toBe(400)
      expect(instance.targetHeight).toBe(300)
    })

    it('keeps existing dimensions when getDimensions returns null', () => {
      const getDimensions = vi.fn().mockReturnValue(null)
      const instance = createInstance({
        getDimensions,
        width: 100,
        height: 50
      })

      instance.handleResize()

      expect(instance.targetWidth).toBe(100)
      expect(instance.targetHeight).toBe(50)
    })
  })
})
