import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CameraState, EventManagerInterface } from './interfaces'
import { ViewHelperManager } from './ViewHelperManager'

interface MockViewHelperInstance {
  camera: THREE.Camera
  domElement: HTMLElement
  animating: boolean
  visible: boolean
  center: THREE.Vector3 | null
  update: ReturnType<typeof vi.fn>
  dispose: ReturnType<typeof vi.fn>
  handleClick: ReturnType<typeof vi.fn>
}

const { viewHelperInstances, mockHandleClick } = vi.hoisted(() => ({
  viewHelperInstances: [] as MockViewHelperInstance[],
  mockHandleClick: vi.fn()
}))

vi.mock('three/examples/jsm/helpers/ViewHelper', () => {
  class ViewHelper {
    animating = false
    visible = true
    center: THREE.Vector3 | null = null
    update = vi.fn()
    dispose = vi.fn()
    handleClick = mockHandleClick
    constructor(
      public camera: THREE.Camera,
      public domElement: HTMLElement
    ) {
      viewHelperInstances.push(this)
    }
  }
  return { ViewHelper }
})

function makeMockEventManager() {
  return {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    emitEvent: vi.fn()
  } satisfies EventManagerInterface
}

function makeOrbitControls(target = new THREE.Vector3()) {
  return { target } as unknown as OrbitControls
}

describe('ViewHelperManager', () => {
  let events: ReturnType<typeof makeMockEventManager>
  let camera: THREE.PerspectiveCamera
  let controls: OrbitControls
  let manager: ViewHelperManager
  const cameraState: CameraState = {
    position: new THREE.Vector3(1, 2, 3),
    target: new THREE.Vector3(4, 5, 6),
    zoom: 1.5,
    cameraType: 'perspective',
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
    fov: 35,
    aspect: 1.5,
    near: 0.1,
    far: 1000,
    frustum: { left: -2, right: 2, top: 2, bottom: -2 }
  }

  beforeEach(() => {
    viewHelperInstances.length = 0
    events = makeMockEventManager()
    camera = new THREE.PerspectiveCamera()
    controls = makeOrbitControls()
    manager = new ViewHelperManager(
      {} as THREE.WebGLRenderer,
      () => camera,
      () => controls,
      () => cameraState,
      events
    )
  })

  describe('createViewHelper', () => {
    it('appends a 128x128 absolutely-positioned container to the parent element', () => {
      const parent = document.createElement('div')

      manager.createViewHelper(parent)

      expect(manager.viewHelperContainer.parentNode).toBe(parent)
      expect(manager.viewHelperContainer.style.width).toBe('128px')
      expect(manager.viewHelperContainer.style.height).toBe('128px')
      expect(manager.viewHelperContainer.style.position).toBe('absolute')
    })

    it('instantiates ViewHelper with the active camera and binds its center to the controls target', () => {
      const target = new THREE.Vector3(1, 2, 3)
      controls = makeOrbitControls(target)
      manager = new ViewHelperManager(
        {} as THREE.WebGLRenderer,
        () => camera,
        () => controls,
        () => cameraState,
        events
      )

      manager.createViewHelper(document.createElement('div'))

      expect(viewHelperInstances).toHaveLength(1)
      expect(viewHelperInstances[0].camera).toBe(camera)
      expect(manager.viewHelper.center).toBe(target)
    })

    it('routes pointerup events to ViewHelper.handleClick and stops propagation', () => {
      const parent = document.createElement('div')
      const propagated = vi.fn()
      parent.addEventListener('pointerup', propagated)
      manager.createViewHelper(parent)

      const event = new PointerEvent('pointerup', { bubbles: true })
      manager.viewHelperContainer.dispatchEvent(event)

      expect(mockHandleClick).toHaveBeenCalledWith(event)
      expect(propagated).not.toHaveBeenCalled()
    })

    it('stops propagation of pointerdown events without forwarding them to ViewHelper', () => {
      const parent = document.createElement('div')
      const propagated = vi.fn()
      parent.addEventListener('pointerdown', propagated)
      manager.createViewHelper(parent)

      manager.viewHelperContainer.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true })
      )

      expect(propagated).not.toHaveBeenCalled()
      expect(mockHandleClick).not.toHaveBeenCalled()
    })
  })

  describe('update', () => {
    it('does nothing when ViewHelper is not animating', () => {
      manager.createViewHelper(document.createElement('div'))
      manager.viewHelper.animating = false

      manager.update(0.5)

      expect(manager.viewHelper.update).not.toHaveBeenCalled()
      expect(events.emitEvent).not.toHaveBeenCalled()
    })

    it('drives the animation while it is in progress without emitting yet', () => {
      manager.createViewHelper(document.createElement('div'))
      manager.viewHelper.animating = true

      manager.update(0.25)

      expect(manager.viewHelper.update).toHaveBeenCalledWith(0.25)
      expect(events.emitEvent).not.toHaveBeenCalled()
    })

    it('emits cameraChanged with the full camera state when the animation just finished', () => {
      manager.createViewHelper(document.createElement('div'))
      manager.viewHelper.animating = true
      ;(
        manager.viewHelper.update as unknown as {
          mockImplementation(fn: () => void): void
        }
      ).mockImplementation(() => {
        manager.viewHelper.animating = false
      })

      manager.update(0)

      expect(events.emitEvent).toHaveBeenCalledWith(
        'cameraChanged',
        cameraState
      )
    })
  })

  describe('visibleViewHelper', () => {
    it('shows the helper and unhides the container when called with true', () => {
      manager.createViewHelper(document.createElement('div'))
      manager.viewHelper.visible = false
      manager.viewHelperContainer.style.display = 'none'

      manager.visibleViewHelper(true)

      expect(manager.viewHelper.visible).toBe(true)
      expect(manager.viewHelperContainer.style.display).toBe('block')
    })

    it('hides the helper and the container when called with false', () => {
      manager.createViewHelper(document.createElement('div'))

      manager.visibleViewHelper(false)

      expect(manager.viewHelper.visible).toBe(false)
      expect(manager.viewHelperContainer.style.display).toBe('none')
    })
  })

  describe('recreateViewHelper', () => {
    it('disposes the old helper and constructs a new one bound to the controls target', () => {
      manager.createViewHelper(document.createElement('div'))
      const oldHelper = manager.viewHelper
      const newTarget = new THREE.Vector3(9, 9, 9)
      controls.target.copy(newTarget)

      manager.recreateViewHelper()

      expect(oldHelper.dispose).toHaveBeenCalled()
      expect(manager.viewHelper).not.toBe(oldHelper)
      expect(viewHelperInstances).toHaveLength(2)
      expect(manager.viewHelper.center).toBe(controls.target)
    })
  })

  describe('dispose', () => {
    it('disposes the helper and removes the container from its parent', () => {
      const parent = document.createElement('div')
      manager.createViewHelper(parent)
      const helper = manager.viewHelper

      manager.dispose()

      expect(helper.dispose).toHaveBeenCalled()
      expect(manager.viewHelperContainer.parentNode).toBeNull()
    })
  })
})
