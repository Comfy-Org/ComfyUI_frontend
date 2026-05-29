import * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ControlsManager } from './ControlsManager'
import type { EventManagerInterface } from './interfaces'

const { mockOrbitControls } = vi.hoisted(() => ({
  mockOrbitControls: vi.fn()
}))

vi.mock('three/examples/jsm/controls/OrbitControls', () => {
  type Listener = () => void
  class OrbitControls {
    object: THREE.Camera
    domElement: HTMLElement
    enableDamping = false
    target = new THREE.Vector3()
    update = vi.fn()
    dispose = vi.fn()
    private listeners = new Map<string, Listener[]>()
    constructor(camera: THREE.Camera, domElement: HTMLElement) {
      this.object = camera
      this.domElement = domElement
      mockOrbitControls(camera, domElement)
    }
    addEventListener(event: string, cb: Listener) {
      if (!this.listeners.has(event)) this.listeners.set(event, [])
      this.listeners.get(event)!.push(cb)
    }
    removeEventListener(event: string, cb: Listener) {
      const list = this.listeners.get(event)
      if (!list) return
      const idx = list.indexOf(cb)
      if (idx >= 0) list.splice(idx, 1)
    }
    fire(event: string) {
      this.listeners.get(event)?.forEach((cb) => cb())
    }
  }
  return { OrbitControls }
})

function makeMockEventManager() {
  return {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    emitEvent: vi.fn()
  } satisfies EventManagerInterface
}

function makeRenderer(opts: { withParent?: boolean } = {}) {
  const canvas = document.createElement('canvas')
  if (opts.withParent) {
    const parent = document.createElement('div')
    parent.appendChild(canvas)
  }
  return { domElement: canvas } as unknown as THREE.WebGLRenderer
}

describe('ControlsManager', () => {
  let events: ReturnType<typeof makeMockEventManager>
  let camera: THREE.PerspectiveCamera
  let manager: ControlsManager

  beforeEach(() => {
    vi.clearAllMocks()
    events = makeMockEventManager()
    camera = new THREE.PerspectiveCamera()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('construction', () => {
    it('attaches OrbitControls to the canvas parent when one exists', () => {
      const renderer = makeRenderer({ withParent: true })

      manager = new ControlsManager(renderer, camera, events)

      expect(mockOrbitControls).toHaveBeenCalledWith(
        camera,
        renderer.domElement.parentElement
      )
      expect(manager.controls.enableDamping).toBe(true)
    })

    it('falls back to the canvas itself when there is no parent', () => {
      const renderer = makeRenderer({ withParent: false })

      manager = new ControlsManager(renderer, camera, events)

      expect(mockOrbitControls).toHaveBeenCalledWith(
        camera,
        renderer.domElement
      )
    })
  })

  describe('init', () => {
    it('emits cameraChanged with a perspective state when the controls fire end', () => {
      manager = new ControlsManager(makeRenderer(), camera, events)
      camera.position.set(1, 2, 3)
      camera.zoom = 1.25
      manager.controls.target.set(4, 5, 6)
      manager.init()

      ;(manager.controls as unknown as { fire(e: string): void }).fire('end')

      expect(events.emitEvent).toHaveBeenCalledWith('cameraChanged', {
        position: expect.objectContaining({ x: 1, y: 2, z: 3 }),
        target: expect.objectContaining({ x: 4, y: 5, z: 6 }),
        zoom: 1.25,
        cameraType: 'perspective'
      })
    })

    it('reports orthographic camera type when initialized with one', () => {
      const ortho = new THREE.OrthographicCamera()
      ortho.zoom = 0.5
      manager = new ControlsManager(makeRenderer(), ortho, events)
      manager.init()

      ;(manager.controls as unknown as { fire(e: string): void }).fire('end')

      expect(events.emitEvent).toHaveBeenCalledWith(
        'cameraChanged',
        expect.objectContaining({ cameraType: 'orthographic', zoom: 0.5 })
      )
    })
  })

  describe('updateCamera', () => {
    it('rebinds controls to the new camera, copies position from the previous one, and preserves the target', () => {
      manager = new ControlsManager(makeRenderer(), camera, events)
      camera.position.set(7, 8, 9)
      manager.controls.target.set(1, 1, 1)

      const newCamera = new THREE.PerspectiveCamera()
      manager.updateCamera(newCamera)

      expect(manager.controls.object).toBe(newCamera)
      expect(newCamera.position.toArray()).toEqual([7, 8, 9])
      expect(manager.controls.target.toArray()).toEqual([1, 1, 1])
      expect(manager.controls.update).toHaveBeenCalled()
    })
  })

  describe('setTarget', () => {
    it('moves the orbit pivot and translates the camera by the same delta so distance is preserved', () => {
      manager = new ControlsManager(makeRenderer(), camera, events)
      camera.position.set(0, 0, 5)
      camera.zoom = 1
      manager.controls.target.set(0, 0, 0)

      manager.setTarget(new THREE.Vector3(1, 2, 3))

      expect(manager.controls.target.toArray()).toEqual([1, 2, 3])
      expect(camera.position.toArray()).toEqual([1, 2, 8])
      expect(manager.controls.update).toHaveBeenCalled()
      expect(events.emitEvent).toHaveBeenCalledWith('cameraChanged', {
        position: expect.objectContaining({ x: 1, y: 2, z: 8 }),
        target: expect.objectContaining({ x: 1, y: 2, z: 3 }),
        zoom: 1,
        cameraType: 'perspective'
      })
    })

    it('moves the camera to the specified distance from the new pivot along the previous direction', () => {
      manager = new ControlsManager(makeRenderer(), camera, events)
      camera.position.set(0, 0, 100)
      manager.controls.target.set(0, 0, 0)

      manager.setTarget(new THREE.Vector3(2, 0, 0), 10)

      expect(camera.position.toArray()).toEqual([2, 0, 10])
    })
  })

  describe('animateTarget', () => {
    it('lerps camera position and target over time and emits cameraChanged on completion', () => {
      manager = new ControlsManager(makeRenderer(), camera, events)
      camera.position.set(0, 0, 10)
      manager.controls.target.set(0, 0, 0)

      let now = 1000
      vi.spyOn(performance, 'now').mockImplementation(() => now)
      const rafQueue: FrameRequestCallback[] = []
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        rafQueue.push(cb)
        return rafQueue.length
      })
      vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})

      manager.animateTarget(new THREE.Vector3(0, 0, 0), 2, 100)
      // Halfway through
      now = 1050
      rafQueue.shift()?.(now)
      expect(camera.position.z).toBeGreaterThan(2)
      expect(camera.position.z).toBeLessThan(10)
      // Past end
      now = 1200
      rafQueue.shift()?.(now)
      expect(camera.position.toArray()).toEqual([0, 0, 2])
      expect(events.emitEvent).toHaveBeenCalledWith(
        'cameraChanged',
        expect.objectContaining({
          position: expect.objectContaining({ x: 0, y: 0, z: 2 })
        })
      )
    })
  })

  describe('update / reset', () => {
    it('update delegates to controls.update', () => {
      manager = new ControlsManager(makeRenderer(), camera, events)

      manager.update()

      expect(manager.controls.update).toHaveBeenCalled()
    })

    it('reset clears the target back to the origin and refreshes', () => {
      manager = new ControlsManager(makeRenderer(), camera, events)
      manager.controls.target.set(5, 6, 7)

      manager.reset()

      expect(manager.controls.target.toArray()).toEqual([0, 0, 0])
      expect(manager.controls.update).toHaveBeenCalled()
    })
  })

  describe('dispose', () => {
    it('disposes the underlying OrbitControls', () => {
      manager = new ControlsManager(makeRenderer(), camera, events)

      manager.dispose()

      expect(manager.controls.dispose).toHaveBeenCalled()
    })
  })
})
