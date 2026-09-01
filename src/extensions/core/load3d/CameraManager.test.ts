import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CameraManager } from './CameraManager'
import type { CameraState, EventManagerInterface } from './interfaces'

function makeMockEventManager() {
  return {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    emitEvent: vi.fn()
  } satisfies EventManagerInterface
}

type ControlsListener = () => void

function makeControlsStub() {
  const listeners: Record<string, ControlsListener[]> = {}
  return {
    target: new THREE.Vector3(),
    object: null as THREE.Camera | null,
    update: vi.fn(),
    addEventListener: vi.fn((event: string, cb: ControlsListener) => {
      listeners[event] = listeners[event] ?? []
      listeners[event].push(cb)
    }),
    fire(event: string) {
      listeners[event]?.forEach((cb) => cb())
    }
  }
}

function makeRenderer(): THREE.WebGLRenderer {
  // CameraManager only stores `_renderer` but never reads it. An empty object
  // suffices and avoids needing a WebGL context in happy-dom.
  return {} as THREE.WebGLRenderer
}

describe('CameraManager', () => {
  let events: ReturnType<typeof makeMockEventManager>
  let manager: CameraManager

  beforeEach(() => {
    vi.clearAllMocks()
    events = makeMockEventManager()
    manager = new CameraManager(makeRenderer(), events)
  })

  describe('construction', () => {
    it('creates both cameras and starts in perspective mode at the default position', () => {
      expect(manager.perspectiveCamera).toBeInstanceOf(THREE.PerspectiveCamera)
      expect(manager.orthographicCamera).toBeInstanceOf(
        THREE.OrthographicCamera
      )
      expect(manager.activeCamera).toBe(manager.perspectiveCamera)
      expect(manager.getCurrentCameraType()).toBe('perspective')
      expect(manager.perspectiveCamera.position.toArray()).toEqual([10, 10, 10])
    })
  })

  describe('toggleCamera', () => {
    it('without an argument flips between perspective and orthographic', () => {
      manager.toggleCamera()
      expect(manager.getCurrentCameraType()).toBe('orthographic')
      manager.toggleCamera()
      expect(manager.getCurrentCameraType()).toBe('perspective')
    })

    it('with an explicit type switches to that type', () => {
      manager.toggleCamera('orthographic')
      expect(manager.activeCamera).toBe(manager.orthographicCamera)
    })

    it('is a no-op when explicitly switched to the active type', () => {
      const before = manager.activeCamera
      manager.toggleCamera('perspective')
      expect(manager.activeCamera).toBe(before)
      expect(events.emitEvent).not.toHaveBeenCalledWith(
        'cameraTypeChange',
        'perspective'
      )
    })

    it('copies position, rotation, and zoom from the old camera to the new one', () => {
      manager.perspectiveCamera.position.set(1, 2, 3)
      manager.perspectiveCamera.rotation.set(0.1, 0.2, 0.3)
      manager.perspectiveCamera.zoom = 1.5

      manager.toggleCamera('orthographic')

      expect(manager.orthographicCamera.position.toArray()).toEqual([1, 2, 3])
      expect(manager.orthographicCamera.zoom).toBe(1.5)
    })

    it('emits cameraTypeChange with the requested type', () => {
      manager.toggleCamera('orthographic')
      expect(events.emitEvent).toHaveBeenCalledWith(
        'cameraTypeChange',
        'orthographic'
      )
    })

    it('rebinds the controls object and target after switching', () => {
      const controls = makeControlsStub()
      controls.target.set(5, 6, 7)
      manager.setControls(controls as unknown as OrbitControls)

      manager.toggleCamera('orthographic')

      expect(controls.object).toBe(manager.orthographicCamera)
      expect(controls.target.toArray()).toEqual([5, 6, 7])
      expect(controls.update).toHaveBeenCalled()
    })
  })

  describe('setFOV', () => {
    it('updates the perspective FOV when perspective is active and emits the value', () => {
      manager.setFOV(60)

      expect(manager.perspectiveCamera.fov).toBe(60)
      expect(events.emitEvent).toHaveBeenCalledWith('fovChange', 60)
    })

    it('does not modify the perspective FOV when orthographic is active', () => {
      manager.toggleCamera('orthographic')
      events.emitEvent.mockClear()
      const before = manager.perspectiveCamera.fov

      manager.setFOV(99)

      expect(manager.perspectiveCamera.fov).toBe(before)
      expect(events.emitEvent).toHaveBeenCalledWith('fovChange', 99)
    })
  })

  describe('camera state round-trip', () => {
    it('captures and restores position, target, zoom, and type', () => {
      const controls = makeControlsStub()
      controls.target.set(2, 3, 4)
      manager.setControls(controls as unknown as OrbitControls)
      manager.perspectiveCamera.position.set(7, 8, 9)
      manager.perspectiveCamera.zoom = 2

      const snapshot = manager.getCameraState()

      expect(snapshot.position.toArray()).toEqual([7, 8, 9])
      expect(snapshot.target.toArray()).toEqual([2, 3, 4])
      expect(snapshot.zoom).toBe(2)
      expect(snapshot.cameraType).toBe('perspective')

      manager.perspectiveCamera.position.set(0, 0, 0)
      manager.perspectiveCamera.zoom = 1
      manager.setCameraState(snapshot)

      expect(manager.perspectiveCamera.position.toArray()).toEqual([7, 8, 9])
      expect(manager.perspectiveCamera.zoom).toBe(2)
      expect(controls.target.toArray()).toEqual([2, 3, 4])
    })

    it('returns a default target when no controls are attached', () => {
      const snapshot = manager.getCameraState()
      expect(snapshot.target.toArray()).toEqual([0, 0, 0])
    })
  })

  describe('setControls', () => {
    it('emits cameraChanged when the controls fire their end event', () => {
      const controls = makeControlsStub()
      manager.setControls(controls as unknown as OrbitControls)
      events.emitEvent.mockClear()

      controls.fire('end')

      expect(events.emitEvent).toHaveBeenCalledWith(
        'cameraChanged',
        expect.objectContaining({
          cameraType: 'perspective'
        }) satisfies Partial<CameraState>
      )
    })
  })

  describe('handleResize', () => {
    it('updates perspective aspect when perspective is active', () => {
      manager.handleResize(800, 400)
      expect(manager.perspectiveCamera.aspect).toBeCloseTo(2)
    })

    it('updates orthographic frustum bounds when orthographic is active', () => {
      manager.toggleCamera('orthographic')

      manager.handleResize(800, 400)

      const cam = manager.orthographicCamera
      const aspect = 2
      const frustumSize = 10
      expect(cam.left).toBeCloseTo((-frustumSize * aspect) / 2)
      expect(cam.right).toBeCloseTo((frustumSize * aspect) / 2)
      expect(cam.top).toBeCloseTo(frustumSize / 2)
      expect(cam.bottom).toBeCloseTo(-frustumSize / 2)
    })
  })

  describe('setupForModel', () => {
    it('positions both cameras based on the model size and centers controls on the target', () => {
      const controls = makeControlsStub()
      manager.setControls(controls as unknown as OrbitControls)

      const size = new THREE.Vector3(2, 4, 2)
      manager.setupForModel(size)

      expect(manager.perspectiveCamera.position.toArray()).toEqual([4, 6, 4])
      expect(manager.orthographicCamera.position.toArray()).toEqual([4, 6, 4])
      expect(controls.target.toArray()).toEqual([0, 2, 0])
      expect(controls.update).toHaveBeenCalled()
    })
  })

  describe('reset', () => {
    it('returns both cameras to the default starting position', () => {
      manager.perspectiveCamera.position.set(99, 99, 99)
      manager.orthographicCamera.position.set(99, 99, 99)

      manager.reset()

      expect(manager.perspectiveCamera.position.toArray()).toEqual([10, 10, 10])
      expect(manager.orthographicCamera.position.toArray()).toEqual([
        10, 10, 10
      ])
    })
  })
})
