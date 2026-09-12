import * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createViewport3dMock } = vi.hoisted(() => ({
  createViewport3dMock: vi.fn()
}))

vi.mock('@/extensions/core/load3d/createViewport3d', () => ({
  createViewport3d: createViewport3dMock
}))

import { CameraAngleViewport } from './CameraAngleViewport'
import {
  MAX_DISPLAY_DISTANCE,
  ORBIT_SPHERE_RADIUS,
  SUBJECT_CENTER,
  YAW_RING_LATITUDE
} from './types'
import type { CameraAngleState } from './types'

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600

function makeViewportStub() {
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_WIDTH
  canvas.height = CANVAS_HEIGHT
  Object.defineProperty(canvas, 'clientWidth', {
    value: CANVAS_WIDTH,
    configurable: true
  })
  Object.defineProperty(canvas, 'clientHeight', {
    value: CANVAS_HEIGHT,
    configurable: true
  })
  canvas.getBoundingClientRect = () =>
    new DOMRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  canvas.setPointerCapture = vi.fn()
  canvas.releasePointerCapture = vi.fn()
  canvas.hasPointerCapture = vi.fn(() => false)

  const activeCamera = new THREE.PerspectiveCamera(
    35,
    CANVAS_WIDTH / CANVAS_HEIGHT
  )
  activeCamera.position.set(0, SUBJECT_CENTER.y + 2, 6)
  activeCamera.lookAt(0, SUBJECT_CENTER.y, 0)
  activeCamera.updateMatrixWorld(true)

  let preRender: (() => void) | null = null
  let postRender: (() => void) | null = null
  let overlay: { dispose(): void } | null = null
  const controls = { enabled: true }
  return {
    sceneManager: {
      scene: new THREE.Scene(),
      toggleGrid: vi.fn(),
      getCurrentBackgroundInfo: () => ({ type: 'color', value: '#123456' })
    },
    cameraManager: { activeCamera },
    controlsManager: { controls },
    viewHelperManager: { visibleViewHelper: vi.fn() },
    renderer: {
      setViewport: vi.fn(),
      setScissor: vi.fn(),
      setScissorTest: vi.fn(),
      setClearColor: vi.fn(),
      clear: vi.fn(),
      render: vi.fn()
    },
    domElement: canvas,
    setOverlay: vi.fn((next: { dispose(): void }) => {
      overlay = next
    }),
    setCameraState: vi.fn(),
    addPreRenderCallback: vi.fn((cb: () => void) => {
      preRender = cb
      return vi.fn()
    }),
    addPostRenderCallback: vi.fn((cb: () => void) => {
      postRender = cb
      return vi.fn()
    }),
    setExternalActiveCamera: vi.fn((camera: THREE.Camera | null) => {
      controls.enabled = camera === null
    }),
    forceRender: vi.fn(),
    remove: vi.fn(() => overlay?.dispose()),
    runPreRender: () => preRender?.(),
    runPostRender: () => postRender?.()
  }
}

function dispatchPointer(
  target: HTMLElement,
  type: string,
  clientX: number,
  clientY: number
): void {
  const event = new MouseEvent(type, { clientX, clientY, button: 0 })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  target.dispatchEvent(event)
}

function dispatchWheel(target: HTMLElement, deltaY: number): void {
  const event = new WheelEvent('wheel')
  Object.defineProperty(event, 'deltaY', { value: deltaY })
  target.dispatchEvent(event)
}

function screenPositionOf(
  world: THREE.Vector3Like,
  camera: THREE.Camera
): { x: number; y: number } {
  const ndc = new THREE.Vector3(world.x, world.y, world.z).project(camera)
  return {
    x: ((ndc.x + 1) / 2) * CANVAS_WIDTH,
    y: ((1 - ndc.y) / 2) * CANVAS_HEIGHT
  }
}

const frames: FrameRequestCallback[] = []

function runFrame(): void {
  const queued = frames.splice(0)
  for (const cb of queued) cb(0)
}

describe('CameraAngleViewport', () => {
  let stub: ReturnType<typeof makeViewportStub>
  let onStateChange: ReturnType<typeof vi.fn<(state: CameraAngleState) => void>>
  let viewport: CameraAngleViewport

  beforeEach(() => {
    frames.length = 0
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb)
      return frames.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => {
      frames.length = 0
    })
    stub = makeViewportStub()
    createViewport3dMock.mockReturnValue(stub)
    onStateChange = vi.fn<(state: CameraAngleState) => void>()
    viewport = new CameraAngleViewport(
      document.createElement('div'),
      { horizontal: 0, vertical: 0, zoom: 5 },
      { onStateChange }
    )
  })

  afterEach(() => {
    viewport.remove()
  })

  it('frames the subject with the overview camera and installs the subject overlay', () => {
    const cameraState = stub.setCameraState.mock.calls[0][0] as {
      position: THREE.Vector3
      target: THREE.Vector3
    }
    expect(cameraState.target.y).toBe(SUBJECT_CENTER.y)
    const distance = cameraState.position.distanceTo(cameraState.target)
    expect(distance * Math.tan((35 / 2) * (Math.PI / 180))).toBeGreaterThan(
      MAX_DISPLAY_DISTANCE
    )
    expect(stub.setOverlay).toHaveBeenCalledWith(viewport.subject)
    expect(stub.sceneManager.toggleGrid).toHaveBeenCalledWith(false)
    expect(stub.controlsManager.controls.enabled).toBe(false)
    expect(viewport.orbitHandles.isVisible()).toBe(true)
    expect(viewport.orbitSphere.isVisible()).toBe(true)
    expect(viewport.cameraMarker.isVisible()).toBe(true)
    expect(stub.viewHelperManager.visibleViewHelper).toHaveBeenCalledWith(false)
  })

  it('refits the overview camera only when the canvas aspect changes', () => {
    const distanceOf = (call: unknown) => {
      const { position, target } = call as {
        position: THREE.Vector3
        target: THREE.Vector3
      }
      return position.distanceTo(target)
    }
    const initial = distanceOf(stub.setCameraState.mock.calls[0][0])
    stub.setCameraState.mockClear()

    stub.runPreRender()
    expect(stub.setCameraState).not.toHaveBeenCalled()

    stub.domElement.width = 300
    stub.runPreRender()
    expect(stub.setCameraState).toHaveBeenCalledOnce()
    expect(distanceOf(stub.setCameraState.mock.calls[0][0])).toBeGreaterThan(
      initial
    )
  })

  it('applies external state to the subject camera and handles', () => {
    viewport.applyState({ horizontal: 90, vertical: 0, zoom: 0 })

    expect(viewport.getState()).toEqual({
      horizontal: 90,
      vertical: 0,
      zoom: 0
    })
    expect(viewport.subject.getSubjectCamera().position.x).toBeGreaterThan(0)
    expect(stub.forceRender).toHaveBeenCalled()
    expect(onStateChange).not.toHaveBeenCalled()
  })

  it('looks through the subject camera in object view and restores the overview after', () => {
    viewport.setViewMode('object')

    expect(stub.setExternalActiveCamera).toHaveBeenCalledWith(
      viewport.subject.getSubjectCamera()
    )
    expect(viewport.orbitHandles.isVisible()).toBe(false)
    expect(viewport.orbitSphere.isVisible()).toBe(false)
    expect(viewport.cameraMarker.isVisible()).toBe(false)
    expect(viewport.getViewMode()).toBe('object')

    stub.viewHelperManager.visibleViewHelper.mockClear()
    viewport.setViewMode('camera')

    expect(stub.setExternalActiveCamera).toHaveBeenLastCalledWith(null)
    expect(stub.controlsManager.controls.enabled).toBe(false)
    expect(viewport.orbitHandles.isVisible()).toBe(true)
    expect(stub.viewHelperManager.visibleViewHelper).toHaveBeenLastCalledWith(
      false
    )
    expect(stub.forceRender.mock.invocationCallOrder.at(-1)).toBeGreaterThan(
      stub.viewHelperManager.visibleViewHelper.mock.invocationCallOrder.at(-1)!
    )
  })

  it('keeps the handles hidden when state changes while in object view', () => {
    viewport.setViewMode('object')
    viewport.applyState({ horizontal: 45, vertical: 10, zoom: 3 })

    expect(viewport.orbitHandles.isVisible()).toBe(false)
  })

  it('fits the subject camera aspect only while in object view', () => {
    const cam = viewport.subject.getSubjectCamera()
    stub.runPreRender()
    expect(cam.aspect).toBe(1)

    viewport.setViewMode('object')
    stub.runPreRender()
    expect(cam.aspect).toBeCloseTo(CANVAS_WIDTH / CANVAS_HEIGHT)
  })

  it('renders the inset preview only when enabled and in camera view', () => {
    stub.runPostRender()
    expect(stub.renderer.render).not.toHaveBeenCalled()

    viewport.setPreviewVisible(true)
    expect(viewport.isPreviewVisible()).toBe(true)
    stub.runPostRender()
    expect(stub.renderer.render).toHaveBeenCalledOnce()
    const [, y, width, height] = stub.renderer.setViewport.mock.lastCall as [
      number,
      number,
      number,
      number
    ]
    expect(width).toBe(height)
    expect(y).toBeGreaterThanOrEqual(48)
    expect(stub.renderer.setClearColor).toHaveBeenLastCalledWith('#123456')

    viewport.setViewMode('object')
    stub.renderer.render.mockClear()
    stub.runPostRender()
    expect(stub.renderer.render).not.toHaveBeenCalled()
  })

  it('turns the subject on drag and zooms on wheel in object view', () => {
    viewport.setViewMode('object')

    dispatchPointer(stub.domElement, 'pointerdown', 100, 100)
    dispatchPointer(stub.domElement, 'pointermove', 140, 100)
    runFrame()
    expect(onStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ horizontal: 340 })
    )

    dispatchWheel(stub.domElement, -100)
    runFrame()
    expect(onStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ zoom: 6 })
    )
  })

  it('ignores drags on empty space in camera view but still zooms on wheel', () => {
    dispatchPointer(stub.domElement, 'pointerdown', 10, 10)
    dispatchPointer(stub.domElement, 'pointermove', 50, 10)
    runFrame()
    expect(onStateChange).not.toHaveBeenCalled()
    expect(stub.domElement.setPointerCapture).not.toHaveBeenCalled()

    dispatchWheel(stub.domElement, 100)
    runFrame()
    expect(onStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ zoom: 4 })
    )
  })

  it('never re-enables the overview orbit controls', () => {
    dispatchPointer(stub.domElement, 'pointerdown', 10, 10)
    dispatchPointer(stub.domElement, 'pointerup', 10, 10)

    expect(stub.controlsManager.controls.enabled).toBe(false)
  })

  it('drags the yaw handle to change the horizontal angle', () => {
    const latitude = (YAW_RING_LATITUDE * Math.PI) / 180
    const yawHandle = screenPositionOf(
      {
        x: 0,
        y: SUBJECT_CENTER.y + ORBIT_SPHERE_RADIUS * Math.sin(latitude),
        z: ORBIT_SPHERE_RADIUS * Math.cos(latitude)
      },
      stub.cameraManager.activeCamera
    )

    dispatchPointer(stub.domElement, 'pointerdown', yawHandle.x, yawHandle.y)

    dispatchPointer(
      stub.domElement,
      'pointermove',
      yawHandle.x + 120,
      yawHandle.y
    )
    runFrame()
    const next = onStateChange.mock.lastCall?.[0] as { horizontal: number }
    expect(next.horizontal).toBeGreaterThan(0)
    expect(next.horizontal).toBeLessThan(90)

    dispatchPointer(
      stub.domElement,
      'pointerup',
      yawHandle.x + 120,
      yawHandle.y
    )
    expect(stub.domElement.style.cursor).toBe('grab')
  })

  it('forwards images to the subject card and re-renders once applied', async () => {
    const setImage = vi
      .spyOn(viewport.subject, 'setImage')
      .mockResolvedValue(true)
    stub.forceRender.mockClear()

    await viewport.setImage('http://example/a.png')

    expect(setImage).toHaveBeenCalledWith('http://example/a.png')
    expect(stub.forceRender).toHaveBeenCalledOnce()
  })

  it('does not render an image that finishes loading after removal', async () => {
    let resolveLoad: (texture: THREE.Texture) => void = () => {}
    const pending = new Promise<THREE.Texture>((resolve) => {
      resolveLoad = resolve
    })
    const deferred = new CameraAngleViewport(
      document.createElement('div'),
      undefined,
      { loadTexture: () => pending }
    )
    const load = deferred.setImage('http://example/late.png')

    deferred.remove()
    stub.forceRender.mockClear()
    resolveLoad(new THREE.Texture())
    await load

    expect(stub.forceRender).not.toHaveBeenCalled()
    expect(deferred.subject.hasImage()).toBe(false)
  })

  it('tears down the viewport on remove', () => {
    viewport.remove()

    expect(stub.remove).toHaveBeenCalledOnce()
    expect(stub.sceneManager.scene.children).toHaveLength(0)
  })
})
