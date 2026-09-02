import * as THREE from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ControlsManager } from './ControlsManager'

const { mockOrbitControls } = vi.hoisted(() => ({
  mockOrbitControls: vi.fn()
}))

vi.mock('three/examples/jsm/controls/OrbitControls', () => {
  type Listener = () => void
  class OrbitControls {
    object: THREE.Camera
    domElement: HTMLElement
    enableDamping = false
    enabled = true
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

function makeElement() {
  return document.createElement('div')
}

describe('ControlsManager', () => {
  let camera: THREE.PerspectiveCamera
  let manager: ControlsManager

  beforeEach(() => {
    camera = new THREE.PerspectiveCamera()
  })

  describe('construction', () => {
    it('attaches OrbitControls to the interaction element', () => {
      const element = makeElement()

      manager = new ControlsManager(element, camera)

      expect(mockOrbitControls).toHaveBeenCalledWith(camera, element)
      expect(manager.controls.enableDamping).toBe(true)
    })
  })

  describe('updateCamera', () => {
    it('rebinds controls to the new camera, copies position from the previous one, and preserves the target', () => {
      manager = new ControlsManager(makeElement(), camera)
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
      manager = new ControlsManager(makeElement(), camera)

      manager.update()

      expect(manager.controls.update).toHaveBeenCalled()
    })

    it('reset clears the target back to the origin and refreshes', () => {
      manager = new ControlsManager(makeElement(), camera)
      manager.controls.target.set(5, 6, 7)

      manager.reset()

      expect(manager.controls.target.toArray()).toEqual([0, 0, 0])
      expect(manager.controls.update).toHaveBeenCalled()
    })
  })

  describe('dispose', () => {
    it('disposes the underlying OrbitControls', () => {
      manager = new ControlsManager(makeElement(), camera)

      manager.dispose()

      expect(manager.controls.dispose).toHaveBeenCalled()
    })
  })

  describe('detach / attach', () => {
    it('detach disables OrbitControls interaction', () => {
      manager = new ControlsManager(makeElement(), camera)
      expect(manager.controls.enabled).toBe(true)

      manager.detach()

      expect(manager.controls.enabled).toBe(false)
    })

    it('attach re-enables OrbitControls interaction', () => {
      manager = new ControlsManager(makeElement(), camera)
      manager.detach()

      manager.attach()

      expect(manager.controls.enabled).toBe(true)
    })
  })
})
