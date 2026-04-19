import type * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CameraState } from './interfaces'

type EventCallback = (data: unknown) => void

function mockClass(factory: () => Record<string, unknown>) {
  return function (this: Record<string, unknown>) {
    Object.assign(this, factory())
  }
}

vi.mock('./AnimationManager', () => ({
  AnimationManager: mockClass(() => ({
    init: vi.fn(),
    dispose: vi.fn(),
    update: vi.fn(),
    setupModelAnimations: vi.fn(),
    isAnimationPlaying: false,
    animationClips: [] as unknown[],
    setAnimationSpeed: vi.fn(),
    updateSelectedAnimation: vi.fn(),
    toggleAnimation: vi.fn(),
    getAnimationTime: vi.fn().mockReturnValue(0),
    getAnimationDuration: vi.fn().mockReturnValue(0),
    setAnimationTime: vi.fn()
  }))
}))

vi.mock('./CameraManager', () => ({
  CameraManager: mockClass(() => ({
    init: vi.fn(),
    dispose: vi.fn(),
    reset: vi.fn(),
    activeCamera: { position: { set: vi.fn() }, lookAt: vi.fn() },
    perspectiveCamera: {
      position: { set: vi.fn() },
      lookAt: vi.fn(),
      updateProjectionMatrix: vi.fn()
    },
    setControls: vi.fn(),
    handleResize: vi.fn(),
    toggleCamera: vi.fn(),
    getCurrentCameraType: vi.fn().mockReturnValue('perspective'),
    setCameraState: vi.fn(),
    getCameraState: vi.fn().mockReturnValue({
      position: { x: 0, y: 0, z: 10 },
      target: { x: 0, y: 0, z: 0 },
      zoom: 1,
      cameraType: 'perspective'
    }),
    setFOV: vi.fn(),
    setupForModel: vi.fn(),
    updateAspectRatio: vi.fn()
  }))
}))

vi.mock('./ControlsManager', () => ({
  ControlsManager: mockClass(() => ({
    init: vi.fn(),
    dispose: vi.fn(),
    reset: vi.fn(),
    controls: {
      target: { copy: vi.fn() },
      update: vi.fn()
    },
    update: vi.fn(),
    updateCamera: vi.fn()
  }))
}))

vi.mock('./EventManager', () => ({
  EventManager: mockClass(() => {
    const listeners: Record<string, EventCallback[]> = {}
    return {
      addEventListener: vi.fn((event: string, cb: EventCallback) => {
        if (!listeners[event]) listeners[event] = []
        listeners[event].push(cb)
      }),
      removeEventListener: vi.fn((event: string, cb: EventCallback) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter((l) => l !== cb)
        }
      }),
      emitEvent: vi.fn((event: string, data: unknown) => {
        listeners[event]?.forEach((cb) => cb(data))
      })
    }
  })
}))

vi.mock('./GizmoManager', () => ({
  GizmoManager: mockClass(() => ({
    init: vi.fn(),
    dispose: vi.fn(),
    setEnabled: vi.fn(),
    setMode: vi.fn(),
    reset: vi.fn(),
    applyTransform: vi.fn(),
    getTransform: vi.fn().mockReturnValue({
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    }),
    setupForModel: vi.fn(),
    updateCamera: vi.fn(),
    detach: vi.fn(),
    removeFromScene: vi.fn(),
    ensureHelperInScene: vi.fn(),
    isEnabled: vi.fn().mockReturnValue(false),
    getMode: vi.fn().mockReturnValue('translate')
  }))
}))

vi.mock('./HDRIManager', () => ({
  HDRIManager: mockClass(() => ({
    init: vi.fn(),
    dispose: vi.fn(),
    loadHDRI: vi.fn().mockResolvedValue(undefined),
    setEnabled: vi.fn(),
    setShowAsBackground: vi.fn(),
    setIntensity: vi.fn(),
    clear: vi.fn()
  }))
}))

vi.mock('./LightingManager', () => ({
  LightingManager: mockClass(() => ({
    init: vi.fn(),
    dispose: vi.fn(),
    setLightIntensity: vi.fn(),
    setHDRIMode: vi.fn()
  }))
}))

vi.mock('./LoaderManager', () => ({
  LoaderManager: mockClass(() => ({
    init: vi.fn(),
    dispose: vi.fn(),
    loadModel: vi.fn().mockResolvedValue(undefined)
  }))
}))

vi.mock('./ModelExporter', () => ({
  ModelExporter: {
    exportGLB: vi.fn().mockResolvedValue(undefined),
    exportOBJ: vi.fn().mockResolvedValue(undefined),
    exportSTL: vi.fn().mockResolvedValue(undefined)
  }
}))

vi.mock('./RecordingManager', () => ({
  RecordingManager: mockClass(() => ({
    init: vi.fn(),
    dispose: vi.fn(),
    startRecording: vi.fn().mockResolvedValue(undefined),
    stopRecording: vi.fn(),
    getIsRecording: vi.fn().mockReturnValue(false),
    getRecordingDuration: vi.fn().mockReturnValue(0),
    getRecordingData: vi.fn().mockReturnValue(null),
    exportRecording: vi.fn(),
    clearRecording: vi.fn()
  }))
}))

vi.mock('./SceneManager', () => ({
  SceneManager: mockClass(() => ({
    scene: {},
    gridHelper: { visible: true },
    init: vi.fn(),
    dispose: vi.fn(),
    handleResize: vi.fn(),
    toggleGrid: vi.fn(),
    setBackgroundColor: vi.fn(),
    setBackgroundImage: vi.fn().mockResolvedValue(undefined),
    removeBackgroundImage: vi.fn(),
    setBackgroundRenderMode: vi.fn(),
    captureScene: vi.fn().mockResolvedValue({
      scene: 'data:image/png;base64,scene',
      mask: 'data:image/png;base64,mask',
      normal: 'data:image/png;base64,normal'
    }),
    renderBackground: vi.fn(),
    backgroundTexture: null,
    backgroundMesh: null,
    updateBackgroundSize: vi.fn()
  }))
}))

vi.mock('./SceneModelManager', () => ({
  SceneModelManager: mockClass(() => ({
    init: vi.fn(),
    dispose: vi.fn(),
    clearModel: vi.fn(),
    currentModel: null,
    originalModel: null,
    originalFileName: null,
    originalURL: null,
    setUpDirection: vi.fn(),
    setMaterialMode: vi.fn(),
    containsSplatMesh: vi.fn().mockReturnValue(false),
    hasSkeleton: vi.fn().mockReturnValue(false),
    setShowSkeleton: vi.fn(),
    showSkeleton: false,
    fitToViewer: vi.fn()
  }))
}))

vi.mock('./ViewHelperManager', () => ({
  ViewHelperManager: mockClass(() => ({
    init: vi.fn(),
    dispose: vi.fn(),
    createViewHelper: vi.fn(),
    update: vi.fn(),
    viewHelper: { render: vi.fn(), dispose: vi.fn() },
    visibleViewHelper: vi.fn(),
    recreateViewHelper: vi.fn()
  }))
}))

vi.mock('three', () => {
  function MockWebGLRenderer(this: Record<string, unknown>) {
    const el = document.createElement('canvas')
    el.classList.add = vi.fn()
    this.setSize = vi.fn()
    this.setClearColor = vi.fn()
    this.autoClear = false
    this.outputColorSpace = ''
    this.domElement = el
    this.setViewport = vi.fn()
    this.setScissor = vi.fn()
    this.setScissorTest = vi.fn()
    this.clear = vi.fn()
    this.render = vi.fn()
    this.dispose = vi.fn()
    this.forceContextLoss = vi.fn()
    this.toneMapping = 0
    this.toneMappingExposure = 1
  }

  function MockClock(this: Record<string, unknown>) {
    this.getDelta = vi.fn().mockReturnValue(0.016)
  }

  function MockBox3(this: Record<string, unknown>) {
    this.setFromObject = vi.fn().mockReturnValue(this)
    this.getSize = vi.fn().mockReturnValue({ x: 1, y: 1, z: 1 })
    this.getCenter = vi.fn().mockReturnValue({ x: 0, y: 0, z: 0 })
  }

  function MockVector3(this: Record<string, unknown>) {
    this.x = 0
    this.y = 0
    this.z = 0
  }

  return {
    WebGLRenderer: MockWebGLRenderer,
    Clock: MockClock,
    Box3: MockBox3,
    Vector3: MockVector3,
    SRGBColorSpace: 'srgb',
    BufferGeometry: function MockBufferGeometry() {}
  }
})

vi.mock('@/composables/useClickDragGuard', () => ({
  exceedsClickThreshold: vi.fn().mockReturnValue(false)
}))

import Load3d from './Load3d'
import { ModelExporter } from './ModelExporter'

function createContainer(): HTMLElement {
  const container = document.createElement('div')
  Object.defineProperty(container, 'clientWidth', { value: 800 })
  Object.defineProperty(container, 'clientHeight', { value: 600 })
  document.body.appendChild(container)
  return container
}

describe('Load3d (comprehensive)', () => {
  let container: HTMLElement
  let load3d: Load3d

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    container = createContainer()
    load3d = new Load3d(container)
  })

  afterEach(() => {
    vi.useRealTimers()
    container.remove()
  })

  describe('constructor', () => {
    it('initializes all sub-managers', () => {
      expect(load3d.eventManager).toBeDefined()
      expect(load3d.sceneManager).toBeDefined()
      expect(load3d.cameraManager).toBeDefined()
      expect(load3d.controlsManager).toBeDefined()
      expect(load3d.lightingManager).toBeDefined()
      expect(load3d.viewHelperManager).toBeDefined()
      expect(load3d.loaderManager).toBeDefined()
      expect(load3d.modelManager).toBeDefined()
      expect(load3d.recordingManager).toBeDefined()
      expect(load3d.animationManager).toBeDefined()
      expect(load3d.gizmoManager).toBeDefined()
    })

    it('initializes mouse status flags to false', () => {
      expect(load3d.STATUS_MOUSE_ON_NODE).toBe(false)
      expect(load3d.STATUS_MOUSE_ON_SCENE).toBe(false)
      expect(load3d.STATUS_MOUSE_ON_VIEWER).toBe(false)
    })

    it('sets INITIAL_RENDER_DONE after deferred forceRender', () => {
      vi.advanceTimersByTime(100)
      expect(load3d.INITIAL_RENDER_DONE).toBe(true)
    })

    it('applies width/height from options', () => {
      const sized = new Load3d(container, { width: 1024, height: 768 })
      expect(sized.targetWidth).toBe(1024)
      expect(sized.targetHeight).toBe(768)
      expect(sized.targetAspectRatio).toBeCloseTo(1024 / 768)
    })

    it('sets isViewerMode from options', () => {
      const viewer = new Load3d(container, { isViewerMode: true })
      expect(viewer.isViewerMode).toBe(true)
    })

    it('defaults to non-viewer mode', () => {
      expect(load3d.isViewerMode).toBe(false)
    })

    it('defaults target dimensions to zero', () => {
      expect(load3d.targetWidth).toBe(0)
      expect(load3d.targetHeight).toBe(0)
      expect(load3d.targetAspectRatio).toBe(1)
    })

    it('appends canvas to the container', () => {
      expect(container.querySelector('canvas')).toBeTruthy()
    })
  })

  describe('manager getters', () => {
    it('returns the correct manager instances', () => {
      expect(load3d.getEventManager()).toBe(load3d.eventManager)
      expect(load3d.getSceneManager()).toBe(load3d.sceneManager)
      expect(load3d.getCameraManager()).toBe(load3d.cameraManager)
      expect(load3d.getControlsManager()).toBe(load3d.controlsManager)
      expect(load3d.getLightingManager()).toBe(load3d.lightingManager)
      expect(load3d.getViewHelperManager()).toBe(load3d.viewHelperManager)
      expect(load3d.getLoaderManager()).toBe(load3d.loaderManager)
      expect(load3d.getModelManager()).toBe(load3d.modelManager)
      expect(load3d.getRecordingManager()).toBe(load3d.recordingManager)
      expect(load3d.getGizmoManager()).toBe(load3d.gizmoManager)
    })
  })

  describe('getTargetSize', () => {
    it('returns current target dimensions', () => {
      load3d.targetWidth = 512
      load3d.targetHeight = 256
      expect(load3d.getTargetSize()).toEqual({ width: 512, height: 256 })
    })
  })

  describe('mouse status updates', () => {
    it('updates STATUS_MOUSE_ON_NODE', () => {
      load3d.updateStatusMouseOnNode(true)
      expect(load3d.STATUS_MOUSE_ON_NODE).toBe(true)
      load3d.updateStatusMouseOnNode(false)
      expect(load3d.STATUS_MOUSE_ON_NODE).toBe(false)
    })

    it('updates STATUS_MOUSE_ON_SCENE', () => {
      load3d.updateStatusMouseOnScene(true)
      expect(load3d.STATUS_MOUSE_ON_SCENE).toBe(true)
    })

    it('updates STATUS_MOUSE_ON_VIEWER', () => {
      load3d.updateStatusMouseOnViewer(true)
      expect(load3d.STATUS_MOUSE_ON_VIEWER).toBe(true)
    })
  })

  describe('isActive', () => {
    it('returns true when INITIAL_RENDER_DONE is false', () => {
      load3d.INITIAL_RENDER_DONE = false
      expect(load3d.isActive()).toBe(true)
    })

    it('returns false when all flags are inactive and initial render done', () => {
      load3d.INITIAL_RENDER_DONE = true
      load3d.STATUS_MOUSE_ON_NODE = false
      load3d.STATUS_MOUSE_ON_SCENE = false
      load3d.STATUS_MOUSE_ON_VIEWER = false
      load3d.animationManager.isAnimationPlaying = false
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

    it('returns true when animation is playing', () => {
      load3d.INITIAL_RENDER_DONE = true
      load3d.animationManager.isAnimationPlaying = true
      expect(load3d.isActive()).toBe(true)
    })

    it('returns true when recording', () => {
      load3d.INITIAL_RENDER_DONE = true
      vi.mocked(load3d.recordingManager.getIsRecording).mockReturnValue(true)
      expect(load3d.isActive()).toBe(true)
    })
  })

  describe('delegation methods', () => {
    it('toggleGrid delegates to sceneManager and calls forceRender', () => {
      const forceRenderSpy = vi.spyOn(load3d, 'forceRender')
      load3d.toggleGrid(false)
      expect(load3d.sceneManager.toggleGrid).toHaveBeenCalledWith(false)
      expect(forceRenderSpy).toHaveBeenCalled()
    })

    it('setBackgroundColor delegates to sceneManager', () => {
      const forceRenderSpy = vi.spyOn(load3d, 'forceRender')
      load3d.setBackgroundColor('#ff0000')
      expect(load3d.sceneManager.setBackgroundColor).toHaveBeenCalledWith(
        '#ff0000'
      )
      expect(forceRenderSpy).toHaveBeenCalled()
    })

    it('removeBackgroundImage delegates to sceneManager', () => {
      const forceRenderSpy = vi.spyOn(load3d, 'forceRender')
      load3d.removeBackgroundImage()
      expect(load3d.sceneManager.removeBackgroundImage).toHaveBeenCalled()
      expect(forceRenderSpy).toHaveBeenCalled()
    })

    it('setBackgroundRenderMode delegates to sceneManager', () => {
      const forceRenderSpy = vi.spyOn(load3d, 'forceRender')
      load3d.setBackgroundRenderMode('panorama')
      expect(load3d.sceneManager.setBackgroundRenderMode).toHaveBeenCalledWith(
        'panorama'
      )
      expect(forceRenderSpy).toHaveBeenCalled()
    })

    it('setUpDirection delegates to modelManager', () => {
      const forceRenderSpy = vi.spyOn(load3d, 'forceRender')
      load3d.setUpDirection('+y')
      expect(load3d.modelManager.setUpDirection).toHaveBeenCalledWith('+y')
      expect(forceRenderSpy).toHaveBeenCalled()
    })

    it('setLightIntensity delegates to lightingManager', () => {
      const forceRenderSpy = vi.spyOn(load3d, 'forceRender')
      load3d.setLightIntensity(5)
      expect(load3d.lightingManager.setLightIntensity).toHaveBeenCalledWith(5)
      expect(forceRenderSpy).toHaveBeenCalled()
    })

    it('setMaterialMode delegates to modelManager', () => {
      const forceRenderSpy = vi.spyOn(load3d, 'forceRender')
      load3d.setMaterialMode('wireframe')
      expect(load3d.modelManager.setMaterialMode).toHaveBeenCalledWith(
        'wireframe'
      )
      expect(forceRenderSpy).toHaveBeenCalled()
    })

    it('setFOV delegates to cameraManager', () => {
      const forceRenderSpy = vi.spyOn(load3d, 'forceRender')
      load3d.setFOV(60)
      expect(load3d.cameraManager.setFOV).toHaveBeenCalledWith(60)
      expect(forceRenderSpy).toHaveBeenCalled()
    })

    it('setCameraState delegates to cameraManager', () => {
      const forceRenderSpy = vi.spyOn(load3d, 'forceRender')
      const state = {} as CameraState
      load3d.setCameraState(state)
      expect(load3d.cameraManager.setCameraState).toHaveBeenCalledWith(state)
      expect(forceRenderSpy).toHaveBeenCalled()
    })

    it('getCameraState delegates to cameraManager', () => {
      const result = load3d.getCameraState()
      expect(load3d.cameraManager.getCameraState).toHaveBeenCalled()
      expect(result).toEqual(
        expect.objectContaining({ cameraType: 'perspective' })
      )
    })

    it('captureScene delegates to sceneManager', async () => {
      const result = await load3d.captureScene(256, 256)
      expect(load3d.sceneManager.captureScene).toHaveBeenCalledWith(256, 256)
      expect(result.scene).toBe('data:image/png;base64,scene')
    })
  })

  describe('HDRI methods', () => {
    it('loadHDRI delegates to hdriManager and force renders', async () => {
      const forceRenderSpy = vi.spyOn(load3d, 'forceRender')
      await load3d.loadHDRI('test.hdr')
      expect(load3d.hdriManager.loadHDRI).toHaveBeenCalledWith('test.hdr')
      expect(forceRenderSpy).toHaveBeenCalled()
    })

    it('setHDRIEnabled delegates to hdriManager and lightingManager', () => {
      const forceRenderSpy = vi.spyOn(load3d, 'forceRender')
      load3d.setHDRIEnabled(true)
      expect(load3d.hdriManager.setEnabled).toHaveBeenCalledWith(true)
      expect(load3d.lightingManager.setHDRIMode).toHaveBeenCalledWith(true)
      expect(forceRenderSpy).toHaveBeenCalled()
    })

    it('setHDRIAsBackground delegates to hdriManager', () => {
      const forceRenderSpy = vi.spyOn(load3d, 'forceRender')
      load3d.setHDRIAsBackground(true)
      expect(load3d.hdriManager.setShowAsBackground).toHaveBeenCalledWith(true)
      expect(forceRenderSpy).toHaveBeenCalled()
    })

    it('setHDRIIntensity delegates to hdriManager', () => {
      const forceRenderSpy = vi.spyOn(load3d, 'forceRender')
      load3d.setHDRIIntensity(2.5)
      expect(load3d.hdriManager.setIntensity).toHaveBeenCalledWith(2.5)
      expect(forceRenderSpy).toHaveBeenCalled()
    })

    it('clearHDRI delegates to hdriManager and disables HDRI mode', () => {
      const forceRenderSpy = vi.spyOn(load3d, 'forceRender')
      load3d.clearHDRI()
      expect(load3d.hdriManager.clear).toHaveBeenCalled()
      expect(load3d.lightingManager.setHDRIMode).toHaveBeenCalledWith(false)
      expect(forceRenderSpy).toHaveBeenCalled()
    })
  })

  describe('toggleCamera', () => {
    it('delegates to camera, controls, gizmo managers, then resizes', () => {
      const handleResizeSpy = vi.spyOn(load3d, 'handleResize')
      load3d.toggleCamera('orthographic')

      expect(load3d.cameraManager.toggleCamera).toHaveBeenCalledWith(
        'orthographic'
      )
      expect(load3d.controlsManager.updateCamera).toHaveBeenCalled()
      expect(load3d.gizmoManager.updateCamera).toHaveBeenCalled()
      expect(load3d.viewHelperManager.recreateViewHelper).toHaveBeenCalled()
      expect(handleResizeSpy).toHaveBeenCalled()
    })
  })

  describe('getCurrentCameraType', () => {
    it('returns the current camera type from cameraManager', () => {
      expect(load3d.getCurrentCameraType()).toBe('perspective')
    })
  })

  describe('getCurrentModel', () => {
    it('returns null when no model is loaded', () => {
      expect(load3d.getCurrentModel()).toBeNull()
    })

    it('returns currentModel from modelManager', () => {
      const mockModel = { type: 'Group' } as unknown as THREE.Object3D
      load3d.modelManager.currentModel = mockModel
      expect(load3d.getCurrentModel()).toBe(mockModel)
    })
  })

  describe('setTargetSize', () => {
    it('updates target dimensions and aspect ratio', () => {
      const handleResizeSpy = vi.spyOn(load3d, 'handleResize')
      load3d.setTargetSize(1920, 1080)

      expect(load3d.targetWidth).toBe(1920)
      expect(load3d.targetHeight).toBe(1080)
      expect(load3d.targetAspectRatio).toBeCloseTo(1920 / 1080)
      expect(handleResizeSpy).toHaveBeenCalled()
    })
  })

  describe('refreshViewport', () => {
    it('calls handleResize', () => {
      const handleResizeSpy = vi.spyOn(load3d, 'handleResize')
      load3d.refreshViewport()
      expect(handleResizeSpy).toHaveBeenCalled()
    })
  })

  describe('event delegation', () => {
    it('addEventListener delegates to eventManager', () => {
      const cb = vi.fn()
      load3d.addEventListener('test', cb)
      expect(load3d.eventManager.addEventListener).toHaveBeenCalledWith(
        'test',
        cb
      )
    })

    it('removeEventListener delegates to eventManager', () => {
      const cb = vi.fn()
      load3d.removeEventListener('test', cb)
      expect(load3d.eventManager.removeEventListener).toHaveBeenCalledWith(
        'test',
        cb
      )
    })
  })

  describe('model query methods', () => {
    it('isSplatModel delegates to modelManager', () => {
      expect(load3d.isSplatModel()).toBe(false)
      vi.mocked(load3d.modelManager.containsSplatMesh).mockReturnValue(true)
      expect(load3d.isSplatModel()).toBe(true)
    })

    it('isPlyModel checks originalModel type', () => {
      expect(load3d.isPlyModel()).toBe(false)
    })

    it('hasSkeleton delegates to modelManager', () => {
      expect(load3d.hasSkeleton()).toBe(false)
    })

    it('setShowSkeleton delegates and force renders', () => {
      const forceRenderSpy = vi.spyOn(load3d, 'forceRender')
      load3d.setShowSkeleton(true)
      expect(load3d.modelManager.setShowSkeleton).toHaveBeenCalledWith(true)
      expect(forceRenderSpy).toHaveBeenCalled()
    })

    it('getShowSkeleton returns modelManager value', () => {
      expect(load3d.getShowSkeleton()).toBe(false)
    })

    it('hasAnimations returns true when clips exist', () => {
      expect(load3d.hasAnimations()).toBe(false)
      load3d.animationManager.animationClips = [
        {} as unknown as THREE.AnimationClip
      ]
      expect(load3d.hasAnimations()).toBe(true)
    })
  })

  describe('animation methods', () => {
    it('setAnimationSpeed delegates to animationManager', () => {
      load3d.setAnimationSpeed(2.0)
      expect(load3d.animationManager.setAnimationSpeed).toHaveBeenCalledWith(
        2.0
      )
    })

    it('updateSelectedAnimation delegates to animationManager', () => {
      load3d.updateSelectedAnimation(3)
      expect(
        load3d.animationManager.updateSelectedAnimation
      ).toHaveBeenCalledWith(3)
    })

    it('toggleAnimation delegates to animationManager', () => {
      load3d.toggleAnimation(true)
      expect(load3d.animationManager.toggleAnimation).toHaveBeenCalledWith(true)
    })

    it('getAnimationTime delegates to animationManager', () => {
      expect(load3d.getAnimationTime()).toBe(0)
    })

    it('getAnimationDuration delegates to animationManager', () => {
      expect(load3d.getAnimationDuration()).toBe(0)
    })

    it('setAnimationTime delegates and force renders', () => {
      const forceRenderSpy = vi.spyOn(load3d, 'forceRender')
      load3d.setAnimationTime(1.5)
      expect(load3d.animationManager.setAnimationTime).toHaveBeenCalledWith(1.5)
      expect(forceRenderSpy).toHaveBeenCalled()
    })
  })

  describe('recording methods', () => {
    it('startRecording hides view helper and delegates', async () => {
      load3d.targetWidth = 512
      load3d.targetHeight = 512
      await load3d.startRecording()
      expect(load3d.viewHelperManager.visibleViewHelper).toHaveBeenCalledWith(
        false
      )
      expect(load3d.recordingManager.startRecording).toHaveBeenCalledWith(
        512,
        512
      )
    })

    it('stopRecording shows view helper and emits event', () => {
      load3d.stopRecording()
      expect(load3d.viewHelperManager.visibleViewHelper).toHaveBeenCalledWith(
        true
      )
      expect(load3d.recordingManager.stopRecording).toHaveBeenCalled()
      expect(load3d.eventManager.emitEvent).toHaveBeenCalledWith(
        'recordingStatusChange',
        false
      )
    })

    it('isRecording delegates to recordingManager', () => {
      expect(load3d.isRecording()).toBe(false)
    })

    it('getRecordingDuration delegates to recordingManager', () => {
      expect(load3d.getRecordingDuration()).toBe(0)
    })

    it('getRecordingData delegates to recordingManager', () => {
      expect(load3d.getRecordingData()).toBeNull()
    })

    it('exportRecording delegates to recordingManager', () => {
      load3d.exportRecording('test.webm')
      expect(load3d.recordingManager.exportRecording).toHaveBeenCalledWith(
        'test.webm'
      )
    })

    it('clearRecording delegates to recordingManager', () => {
      load3d.clearRecording()
      expect(load3d.recordingManager.clearRecording).toHaveBeenCalled()
    })
  })

  describe('clearModel', () => {
    it('disposes animation, detaches gizmo, clears model, and force renders', () => {
      const forceRenderSpy = vi.spyOn(load3d, 'forceRender')
      load3d.clearModel()
      expect(load3d.animationManager.dispose).toHaveBeenCalled()
      expect(load3d.gizmoManager.detach).toHaveBeenCalled()
      expect(load3d.modelManager.clearModel).toHaveBeenCalled()
      expect(forceRenderSpy).toHaveBeenCalled()
    })
  })

  describe('loadModel', () => {
    it('resets camera, controls, gizmo, and model before loading', async () => {
      await load3d.loadModel('http://example.com/model.glb', 'model.glb')

      expect(load3d.cameraManager.reset).toHaveBeenCalled()
      expect(load3d.controlsManager.reset).toHaveBeenCalled()
      expect(load3d.gizmoManager.detach).toHaveBeenCalled()
      expect(load3d.modelManager.clearModel).toHaveBeenCalled()
      expect(load3d.animationManager.dispose).toHaveBeenCalled()
      expect(load3d.loaderManager.loadModel).toHaveBeenCalledWith(
        'http://example.com/model.glb',
        'model.glb'
      )
    })

    it('sets up animations when model has them after loading', async () => {
      const mockModel = {} as THREE.Object3D
      const mockOriginalModel = {} as THREE.Object3D
      load3d.modelManager.currentModel = mockModel
      load3d.modelManager.originalModel = mockOriginalModel

      await load3d.loadModel('http://example.com/model.glb')

      expect(load3d.animationManager.setupModelAnimations).toHaveBeenCalledWith(
        mockModel,
        mockOriginalModel
      )
    })

    it('waits for previous load to finish before starting new one', async () => {
      let resolveFirst!: () => void
      const firstPromise = new Promise<void>((r) => {
        resolveFirst = r
      })
      vi.mocked(load3d.loaderManager.loadModel).mockReturnValueOnce(
        firstPromise
      )

      const firstLoad = load3d.loadModel('first.glb')
      const secondLoad = load3d.loadModel('second.glb')

      resolveFirst()
      await firstLoad
      await secondLoad

      expect(load3d.loaderManager.loadModel).toHaveBeenCalledTimes(2)
    })
  })

  describe('exportModel', () => {
    it('throws when no model is loaded', async () => {
      load3d.modelManager.currentModel = null
      await expect(load3d.exportModel('glb')).rejects.toThrow(
        'No model to export'
      )
    })

    it('exports GLB format', async () => {
      vi.useRealTimers()
      load3d.modelManager.currentModel = {
        clone: vi.fn()
      } as unknown as THREE.Object3D
      load3d.modelManager.originalFileName = 'test'

      await load3d.exportModel('glb')

      expect(ModelExporter.exportGLB).toHaveBeenCalled()
      expect(load3d.eventManager.emitEvent).toHaveBeenCalledWith(
        'exportLoadingStart',
        expect.any(String)
      )
      expect(load3d.eventManager.emitEvent).toHaveBeenCalledWith(
        'exportLoadingEnd',
        null
      )
    })

    it('exports OBJ format', async () => {
      vi.useRealTimers()
      load3d.modelManager.currentModel = {
        clone: vi.fn()
      } as unknown as THREE.Object3D
      load3d.modelManager.originalFileName = 'test'

      await load3d.exportModel('obj')

      expect(ModelExporter.exportOBJ).toHaveBeenCalled()
    })

    it('exports STL format', async () => {
      vi.useRealTimers()
      load3d.modelManager.currentModel = {
        clone: vi.fn()
      } as unknown as THREE.Object3D
      load3d.modelManager.originalFileName = 'test'

      await load3d.exportModel('stl')

      expect(ModelExporter.exportSTL).toHaveBeenCalled()
    })

    it('throws on unsupported format', async () => {
      vi.useRealTimers()
      load3d.modelManager.currentModel = {
        clone: vi.fn()
      } as unknown as THREE.Object3D

      await expect(load3d.exportModel('fbx')).rejects.toThrow(
        'Unsupported export format: fbx'
      )
    })

    it('emits exportLoadingEnd even on error', async () => {
      vi.useRealTimers()
      load3d.modelManager.currentModel = {
        clone: vi.fn()
      } as unknown as THREE.Object3D
      vi.mocked(ModelExporter.exportGLB).mockRejectedValueOnce(
        new Error('fail')
      )

      await expect(load3d.exportModel('glb')).rejects.toThrow('fail')
      expect(load3d.eventManager.emitEvent).toHaveBeenCalledWith(
        'exportLoadingEnd',
        null
      )
    })
  })

  describe('forceRender', () => {
    it('sets INITIAL_RENDER_DONE to true after rendering', () => {
      load3d.INITIAL_RENDER_DONE = false
      load3d.forceRender()
      expect(load3d.INITIAL_RENDER_DONE).toBe(true)
    })

    it('updates animation, view helper, and controls', () => {
      load3d.forceRender()
      expect(load3d.animationManager.update).toHaveBeenCalled()
      expect(load3d.viewHelperManager.update).toHaveBeenCalled()
      expect(load3d.controlsManager.update).toHaveBeenCalled()
    })
  })

  describe('handleResize', () => {
    it('delegates resize to renderer and managers when no aspect ratio', () => {
      load3d.targetWidth = 0
      load3d.targetHeight = 0
      load3d.isViewerMode = false

      load3d.handleResize()

      expect(load3d.renderer.setSize).toHaveBeenCalled()
      expect(load3d.cameraManager.handleResize).toHaveBeenCalled()
      expect(load3d.sceneManager.handleResize).toHaveBeenCalled()
    })

    it('uses getDimensions callback when provided', () => {
      const getDimensions = vi.fn().mockReturnValue({ width: 640, height: 480 })
      const instance = new Load3d(container, { getDimensions })

      instance.handleResize()

      expect(instance.targetWidth).toBe(640)
      expect(instance.targetHeight).toBe(480)
    })

    it('maintains aspect ratio in viewer mode', () => {
      load3d.isViewerMode = true
      load3d.targetWidth = 100
      load3d.targetHeight = 100

      load3d.handleResize()

      expect(load3d.renderer.setSize).toHaveBeenCalled()
      expect(load3d.cameraManager.handleResize).toHaveBeenCalled()
    })
  })

  describe('remove', () => {
    it('disposes all managers and renderer', () => {
      load3d.remove()

      expect(load3d.sceneManager.dispose).toHaveBeenCalled()
      expect(load3d.cameraManager.dispose).toHaveBeenCalled()
      expect(load3d.controlsManager.dispose).toHaveBeenCalled()
      expect(load3d.lightingManager.dispose).toHaveBeenCalled()
      expect(load3d.hdriManager.dispose).toHaveBeenCalled()
      expect(load3d.viewHelperManager.dispose).toHaveBeenCalled()
      expect(load3d.loaderManager.dispose).toHaveBeenCalled()
      expect(load3d.modelManager.dispose).toHaveBeenCalled()
      expect(load3d.recordingManager.dispose).toHaveBeenCalled()
      expect(load3d.animationManager.dispose).toHaveBeenCalled()
      expect(load3d.gizmoManager.dispose).toHaveBeenCalled()
      expect(load3d.renderer.dispose).toHaveBeenCalled()
      expect(load3d.renderer.forceContextLoss).toHaveBeenCalled()
    })
  })

  describe('captureThumbnail', () => {
    it('throws when no model is loaded', async () => {
      load3d.modelManager.currentModel = null
      await expect(load3d.captureThumbnail()).rejects.toThrow(
        'No model loaded for thumbnail capture'
      )
    })

    it('captures thumbnail and restores state', async () => {
      const mockModel = {} as THREE.Object3D
      load3d.modelManager.currentModel = mockModel
      load3d.sceneManager.gridHelper.visible = true

      const result = await load3d.captureThumbnail(128, 128)

      expect(result).toBe('data:image/png;base64,scene')
      expect(load3d.sceneManager.captureScene).toHaveBeenCalledWith(128, 128)
      expect(load3d.sceneManager.gridHelper.visible).toBe(true)
    })

    it('restores camera state after capture', async () => {
      load3d.modelManager.currentModel = {} as THREE.Object3D

      await load3d.captureThumbnail()

      expect(load3d.cameraManager.setCameraState).toHaveBeenCalled()
    })
  })
})
