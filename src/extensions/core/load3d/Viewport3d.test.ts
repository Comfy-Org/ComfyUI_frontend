import * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Viewport3d } from '@/extensions/core/load3d/Viewport3d'

type CameraStub = {
  toggleCamera: ReturnType<typeof vi.fn>
  setupForModel: ReturnType<typeof vi.fn>
  reset: ReturnType<typeof vi.fn>
  getCameraState: ReturnType<typeof vi.fn>
  setCameraState: ReturnType<typeof vi.fn>
  setFOV: ReturnType<typeof vi.fn>
  getCurrentCameraType: ReturnType<typeof vi.fn>
  handleResize: ReturnType<typeof vi.fn>
  updateAspectRatio: ReturnType<typeof vi.fn>
  activeCamera: THREE.Camera
}

type SceneStub = {
  captureScene: ReturnType<typeof vi.fn>
  setBackgroundColor: ReturnType<typeof vi.fn>
  setBackgroundImage: ReturnType<typeof vi.fn>
  removeBackgroundImage: ReturnType<typeof vi.fn>
  toggleGrid: ReturnType<typeof vi.fn>
  setBackgroundRenderMode: ReturnType<typeof vi.fn>
  handleResize: ReturnType<typeof vi.fn>
  renderBackground: ReturnType<typeof vi.fn>
  dispose: ReturnType<typeof vi.fn>
  updateBackgroundSize: ReturnType<typeof vi.fn>
  backgroundTexture: unknown
  backgroundMesh: unknown
  scene: THREE.Scene
}

function makeViewportInstance() {
  const cameraManager: CameraStub = {
    toggleCamera: vi.fn(),
    setupForModel: vi.fn(),
    reset: vi.fn(),
    getCameraState: vi.fn(() => ({
      position: new THREE.Vector3(),
      target: new THREE.Vector3(),
      zoom: 1,
      cameraType: 'perspective' as const
    })),
    setCameraState: vi.fn(),
    setFOV: vi.fn(),
    getCurrentCameraType: vi.fn(() => 'perspective' as const),
    handleResize: vi.fn(),
    updateAspectRatio: vi.fn(),
    activeCamera: new THREE.PerspectiveCamera()
  }
  const sceneManager: SceneStub = {
    captureScene: vi.fn(),
    setBackgroundColor: vi.fn(),
    setBackgroundImage: vi.fn().mockResolvedValue(undefined),
    removeBackgroundImage: vi.fn(),
    toggleGrid: vi.fn(),
    setBackgroundRenderMode: vi.fn(),
    handleResize: vi.fn(),
    renderBackground: vi.fn(),
    dispose: vi.fn(),
    updateBackgroundSize: vi.fn(),
    backgroundTexture: null,
    backgroundMesh: null,
    scene: new THREE.Scene()
  }
  const controlsManager = {
    updateCamera: vi.fn(),
    update: vi.fn(),
    dispose: vi.fn(),
    reset: vi.fn(),
    detach: vi.fn(),
    attach: vi.fn()
  }
  const lightingManager = {
    setLightIntensity: vi.fn(),
    dispose: vi.fn()
  }
  const viewHelperManager = {
    recreateViewHelper: vi.fn(),
    update: vi.fn(),
    visibleViewHelper: vi.fn(),
    viewHelper: { render: vi.fn() },
    dispose: vi.fn()
  }
  const eventManager = {
    emitEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }

  const viewport = Object.create(Viewport3d.prototype) as Viewport3d
  Object.assign(viewport, {
    cameraManager,
    sceneManager,
    controlsManager,
    lightingManager,
    viewHelperManager,
    eventManager,
    forceRender: vi.fn(),
    handleResize: vi.fn()
  })

  return {
    viewport,
    cameraManager,
    sceneManager,
    controlsManager,
    lightingManager,
    viewHelperManager,
    eventManager,
    forceRender: viewport.forceRender as ReturnType<typeof vi.fn>
  }
}

describe('Viewport3d', () => {
  let ctx: ReturnType<typeof makeViewportInstance>

  beforeEach(() => {
    ctx = makeViewportInstance()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('camera delegation (model-independent)', () => {
    it('toggleCamera updates controls and recreates view helper without touching model state', () => {
      ctx.viewport.toggleCamera('orthographic')

      expect(ctx.cameraManager.toggleCamera).toHaveBeenCalledWith(
        'orthographic'
      )
      expect(ctx.controlsManager.updateCamera).toHaveBeenCalledWith(
        ctx.cameraManager.activeCamera
      )
      expect(ctx.viewHelperManager.recreateViewHelper).toHaveBeenCalledOnce()
    })
  })

  describe('isActive (no model concerns)', () => {
    it('returns false when no mouse activity is present', () => {
      Object.assign(ctx.viewport, {
        STATUS_MOUSE_ON_NODE: false,
        STATUS_MOUSE_ON_SCENE: false,
        STATUS_MOUSE_ON_VIEWER: false,
        INITIAL_RENDER_DONE: true
      })
      expect(ctx.viewport.isActive()).toBe(false)
    })

    it('does not consult recording or animation state — that is a Load3d concern', () => {
      Object.assign(ctx.viewport, {
        STATUS_MOUSE_ON_NODE: false,
        STATUS_MOUSE_ON_SCENE: false,
        STATUS_MOUSE_ON_VIEWER: false,
        INITIAL_RENDER_DONE: true
      })
      expect(() => ctx.viewport.isActive()).not.toThrow()
    })
  })

  describe('manager accessors', () => {
    it('exposes managers through both fields and getters', () => {
      expect(ctx.viewport.cameraManager).toBe(ctx.cameraManager)
      expect(ctx.viewport.getCameraManager()).toBe(ctx.cameraManager)
      expect(ctx.viewport.sceneManager).toBe(ctx.sceneManager)
      expect(ctx.viewport.getSceneManager()).toBe(ctx.sceneManager)
      expect(ctx.viewport.controlsManager).toBe(ctx.controlsManager)
      expect(ctx.viewport.getControlsManager()).toBe(ctx.controlsManager)
      expect(ctx.viewport.lightingManager).toBe(ctx.lightingManager)
      expect(ctx.viewport.getLightingManager()).toBe(ctx.lightingManager)
      expect(ctx.viewport.viewHelperManager).toBe(ctx.viewHelperManager)
      expect(ctx.viewport.getViewHelperManager()).toBe(ctx.viewHelperManager)
      expect(ctx.viewport.eventManager).toBe(ctx.eventManager)
      expect(ctx.viewport.getEventManager()).toBe(ctx.eventManager)
    })
  })

  describe('POV swap (setExternalActiveCamera)', () => {
    it('getRenderCamera returns the orbit camera when no external camera is set', () => {
      expect(ctx.viewport.getRenderCamera()).toBe(
        ctx.cameraManager.activeCamera
      )
    })

    it('getRenderCamera returns the external camera once installed', () => {
      const subjectCamera = new THREE.PerspectiveCamera()
      ctx.viewport.setExternalActiveCamera(subjectCamera)

      expect(ctx.viewport.getRenderCamera()).toBe(subjectCamera)
    })

    it('installing an external camera detaches controls and hides the view helper', () => {
      const subjectCamera = new THREE.PerspectiveCamera()
      ctx.viewport.setExternalActiveCamera(subjectCamera)

      expect(ctx.controlsManager.detach).toHaveBeenCalledOnce()
      expect(ctx.viewHelperManager.visibleViewHelper).toHaveBeenCalledWith(
        false
      )
      expect(ctx.forceRender).toHaveBeenCalled()
    })

    it('clearing the external camera re-attaches controls and shows the view helper', () => {
      const subjectCamera = new THREE.PerspectiveCamera()
      ctx.viewport.setExternalActiveCamera(subjectCamera)
      ctx.controlsManager.detach.mockClear()
      ctx.controlsManager.attach.mockClear()
      ctx.viewHelperManager.visibleViewHelper.mockClear()

      ctx.viewport.setExternalActiveCamera(null)

      expect(ctx.controlsManager.attach).toHaveBeenCalledOnce()
      expect(ctx.viewHelperManager.visibleViewHelper).toHaveBeenCalledWith(true)
      expect(ctx.viewport.getRenderCamera()).toBe(
        ctx.cameraManager.activeCamera
      )
    })

    it('setting the same external camera twice is a no-op', () => {
      const subjectCamera = new THREE.PerspectiveCamera()
      ctx.viewport.setExternalActiveCamera(subjectCamera)
      ctx.controlsManager.detach.mockClear()

      ctx.viewport.setExternalActiveCamera(subjectCamera)

      expect(ctx.controlsManager.detach).not.toHaveBeenCalled()
    })
  })

  describe('overlay', () => {
    function makeOverlay() {
      return {
        attach: vi.fn(),
        detach: vi.fn(),
        update: vi.fn(),
        onActiveCameraChange: vi.fn(),
        dispose: vi.fn()
      }
    }

    it('setOverlay attaches to the scene and notifies of the current render camera', () => {
      const overlay = makeOverlay()
      ctx.viewport.setOverlay(overlay)

      expect(overlay.attach).toHaveBeenCalledWith(ctx.sceneManager.scene)
      expect(overlay.onActiveCameraChange).toHaveBeenCalledWith(
        ctx.cameraManager.activeCamera
      )
      expect(ctx.viewport.getOverlay()).toBe(overlay)
    })

    it('replacing an overlay detaches and disposes the prior one', () => {
      const first = makeOverlay()
      const second = makeOverlay()
      ctx.viewport.setOverlay(first)
      ctx.viewport.setOverlay(second)

      expect(first.detach).toHaveBeenCalledOnce()
      expect(first.dispose).toHaveBeenCalledOnce()
      expect(second.attach).toHaveBeenCalledWith(ctx.sceneManager.scene)
      expect(ctx.viewport.getOverlay()).toBe(second)
    })

    it('removeOverlay detaches and disposes the installed overlay', () => {
      const overlay = makeOverlay()
      ctx.viewport.setOverlay(overlay)

      ctx.viewport.removeOverlay()

      expect(overlay.detach).toHaveBeenCalledOnce()
      expect(overlay.dispose).toHaveBeenCalledOnce()
      expect(ctx.viewport.getOverlay()).toBeNull()
    })

    it('tickPerFrame forwards delta to the overlay before view-helper/controls update', () => {
      const overlay = makeOverlay()
      ctx.viewport.setOverlay(overlay)

      const tick = (
        ctx.viewport as unknown as {
          tickPerFrame(delta: number): void
        }
      ).tickPerFrame.bind(ctx.viewport)
      tick(0.016)

      expect(overlay.update).toHaveBeenCalledWith(0.016)
      expect(ctx.viewHelperManager.update).toHaveBeenCalledWith(0.016)
      expect(ctx.controlsManager.update).toHaveBeenCalledOnce()
    })

    it('toggleCamera notifies the overlay with the new orbit camera (when no POV)', () => {
      const overlay = makeOverlay()
      ctx.viewport.setOverlay(overlay)
      overlay.onActiveCameraChange.mockClear()

      ctx.viewport.toggleCamera('orthographic')

      expect(overlay.onActiveCameraChange).toHaveBeenCalledWith(
        ctx.cameraManager.activeCamera
      )
    })

    it('toggleCamera does NOT notify the overlay while a POV camera is active', () => {
      const overlay = makeOverlay()
      const subjectCamera = new THREE.PerspectiveCamera()
      ctx.viewport.setOverlay(overlay)
      ctx.viewport.setExternalActiveCamera(subjectCamera)
      overlay.onActiveCameraChange.mockClear()

      ctx.viewport.toggleCamera('orthographic')

      expect(overlay.onActiveCameraChange).not.toHaveBeenCalled()
    })

    it('setExternalActiveCamera notifies the overlay with the new render camera', () => {
      const overlay = makeOverlay()
      const subjectCamera = new THREE.PerspectiveCamera()
      ctx.viewport.setOverlay(overlay)
      overlay.onActiveCameraChange.mockClear()

      ctx.viewport.setExternalActiveCamera(subjectCamera)

      expect(overlay.onActiveCameraChange).toHaveBeenCalledWith(subjectCamera)
    })
  })

  describe('applyTargetSize guards', () => {
    function applyTargetSize(width: number, height: number): void {
      ;(
        ctx.viewport as unknown as {
          applyTargetSize(w: number, h: number): void
        }
      ).applyTargetSize(width, height)
    }

    beforeEach(() => {
      Object.assign(ctx.viewport, {
        targetWidth: 0,
        targetHeight: 0,
        targetAspectRatio: 1
      })
    })

    it('writes width / height / aspect when both inputs are positive finite', () => {
      applyTargetSize(800, 400)

      expect(ctx.viewport.targetWidth).toBe(800)
      expect(ctx.viewport.targetHeight).toBe(400)
      expect(ctx.viewport.targetAspectRatio).toBe(2)
    })

    it.for([
      ['zero width', 0, 100],
      ['zero height', 100, 0],
      ['negative width', -100, 100],
      ['negative height', 100, -100],
      ['NaN width', Number.NaN, 100],
      ['Infinity height', 100, Number.POSITIVE_INFINITY]
    ] as const)('rejects %s without touching prior state', ([, w, h]) => {
      Object.assign(ctx.viewport, {
        targetWidth: 800,
        targetHeight: 400,
        targetAspectRatio: 2
      })

      applyTargetSize(w, h)

      expect(ctx.viewport.targetWidth).toBe(800)
      expect(ctx.viewport.targetHeight).toBe(400)
      expect(ctx.viewport.targetAspectRatio).toBe(2)
    })

    it('setTargetSize routes through the guard', () => {
      Object.assign(ctx.viewport, {
        targetWidth: 800,
        targetHeight: 400,
        targetAspectRatio: 2
      })

      ctx.viewport.setTargetSize(0, 0)

      expect(ctx.viewport.targetAspectRatio).toBe(2)
    })
  })

  describe('start / remove lifecycle', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      Object.assign(ctx.viewport, {
        hasStarted: false,
        initialRenderTimer: null,
        startAnimation: vi.fn(),
        renderLoop: { stop: vi.fn() },
        disposeContextMenuGuard: null,
        view: {
          canvas: document.createElement('canvas'),
          dispose: vi.fn()
        },
        disposeManagers: vi.fn()
      })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('start schedules a deferred forceRender and remove clears it before the timer fires', () => {
      ctx.viewport.start()
      ctx.forceRender.mockClear()

      ctx.viewport.remove()
      vi.advanceTimersByTime(500)

      expect(ctx.forceRender).not.toHaveBeenCalled()
    })

    it('the deferred forceRender does fire when remove is not called', () => {
      ctx.viewport.start()
      ctx.forceRender.mockClear()

      vi.advanceTimersByTime(100)

      expect(ctx.forceRender).toHaveBeenCalledOnce()
    })
  })
})
