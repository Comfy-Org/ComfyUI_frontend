import * as THREE from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
