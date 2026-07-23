import * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createViewport3dMock } = vi.hoisted(() => ({
  createViewport3dMock: vi.fn()
}))

vi.mock('@/extensions/core/load3d/createViewport3d', () => ({
  createViewport3d: createViewport3dMock
}))

import { CameraInfoViewport } from './CameraInfoViewport'

function makeViewportStub() {
  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 600
  Object.defineProperty(canvas, 'clientWidth', {
    value: 800,
    configurable: true
  })
  Object.defineProperty(canvas, 'clientHeight', {
    value: 600,
    configurable: true
  })
  canvas.setPointerCapture = vi.fn()
  canvas.releasePointerCapture = vi.fn()
  canvas.hasPointerCapture = vi.fn(() => false)
  let preRender: (() => void) | null = null
  let postRender: (() => void) | null = null
  return {
    sceneManager: { scene: new THREE.Scene() },
    cameraManager: { activeCamera: new THREE.PerspectiveCamera() },
    controlsManager: { controls: { enabled: true } },
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
    setOverlay: vi.fn(),
    addPreRenderCallback: vi.fn((cb: () => void) => {
      preRender = cb
      return vi.fn()
    }),
    addPostRenderCallback: vi.fn((cb: () => void) => {
      postRender = cb
      return vi.fn()
    }),
    setExternalActiveCamera: vi.fn(),
    forceRender: vi.fn(),
    remove: vi.fn(),
    runPreRender: () => preRender?.(),
    runPostRender: () => postRender?.()
  }
}

describe('CameraInfoViewport look-through', () => {
  let stub: ReturnType<typeof makeViewportStub>
  let viewport: CameraInfoViewport

  beforeEach(() => {
    stub = makeViewportStub()
    createViewport3dMock.mockReturnValue(stub)
    viewport = new CameraInfoViewport(document.createElement('div'))
  })

  afterEach(() => {
    viewport.remove()
  })

  it('renders the main viewport through the subject camera', () => {
    viewport.setLookThrough(true)

    expect(stub.setExternalActiveCamera).toHaveBeenCalledWith(
      viewport.overlay.getSubjectCamera()
    )
    expect(viewport.orbitHandles.isVisible()).toBe(false)
  })

  it('restores the orbit view and keeps the gnomon hidden on exit', () => {
    viewport.setLookThrough(true)
    stub.viewHelperManager.visibleViewHelper.mockClear()

    viewport.setLookThrough(false)

    expect(stub.setExternalActiveCamera).toHaveBeenLastCalledWith(null)
    expect(viewport.orbitHandles.isVisible()).toBe(true)
    expect(stub.viewHelperManager.visibleViewHelper).toHaveBeenLastCalledWith(
      false
    )
  })

  it('is idempotent for repeated toggles', () => {
    viewport.setLookThrough(true)
    viewport.setLookThrough(true)

    expect(stub.setExternalActiveCamera).toHaveBeenCalledTimes(1)
  })

  it('re-syncs the external camera when the camera type changes while looking through', () => {
    viewport.setLookThrough(true)
    stub.setExternalActiveCamera.mockClear()

    const state = viewport.overlay.getState()
    viewport.applyState({ ...state, cameraType: 'orthographic' })

    expect(stub.setExternalActiveCamera).toHaveBeenCalledWith(
      viewport.overlay.getSubjectCamera()
    )
  })

  it('leaves the external camera untouched on state changes outside look-through', () => {
    viewport.applyState(viewport.overlay.getState())

    expect(stub.setExternalActiveCamera).not.toHaveBeenCalled()
  })

  it('keeps handles hidden while looking through even when gizmos are toggled', () => {
    viewport.setLookThrough(true)
    viewport.setGizmosVisible(false)

    expect(viewport.orbitHandles.isVisible()).toBe(false)
  })

  it('fits the subject camera aspect in the pre-render pass while looking through', () => {
    viewport.setLookThrough(true)
    const cam = viewport.overlay.getSubjectCamera() as THREE.PerspectiveCamera
    cam.aspect = 1
    cam.updateProjectionMatrix()

    stub.runPreRender()

    expect(cam.aspect).toBeCloseTo(800 / 600)
  })

  it('leaves the subject camera aspect untouched outside look-through', () => {
    const cam = viewport.overlay.getSubjectCamera() as THREE.PerspectiveCamera
    cam.aspect = 1
    cam.updateProjectionMatrix()

    stub.runPreRender()

    expect(cam.aspect).toBe(1)
  })
})

describe('CameraInfoViewport gizmo visibility', () => {
  let stub: ReturnType<typeof makeViewportStub>
  let viewport: CameraInfoViewport

  beforeEach(() => {
    stub = makeViewportStub()
    createViewport3dMock.mockReturnValue(stub)
    viewport = new CameraInfoViewport(document.createElement('div'))
  })

  afterEach(() => {
    viewport.remove()
  })

  it('hides orbit handles when gizmos are turned off', () => {
    expect(viewport.orbitHandles.isVisible()).toBe(true)

    viewport.setGizmosVisible(false)
    expect(viewport.orbitHandles.isVisible()).toBe(false)

    viewport.setGizmosVisible(true)
    expect(viewport.orbitHandles.isVisible()).toBe(true)
  })

  it('reveals the target handle in target transform mode', () => {
    viewport.setTransformGizmoMode('target')

    expect(viewport.targetHandle.isVisible()).toBe(true)
  })

  it('enables the camera handle for camera-rotate in quaternion mode', () => {
    viewport.applyState({ ...viewport.overlay.getState(), mode: 'quaternion' })
    viewport.setTransformGizmoMode('camera-rotate')

    expect(viewport.cameraHandle.isVisible()).toBe(true)
  })

  it('hides the transform handles when gizmos are turned off', () => {
    viewport.setTransformGizmoMode('target')
    expect(viewport.targetHandle.isVisible()).toBe(true)

    viewport.setGizmosVisible(false)
    expect(viewport.targetHandle.isVisible()).toBe(false)
  })
})

describe('CameraInfoViewport subject preview', () => {
  let stub: ReturnType<typeof makeViewportStub>
  let viewport: CameraInfoViewport

  beforeEach(() => {
    stub = makeViewportStub()
    createViewport3dMock.mockReturnValue(stub)
    viewport = new CameraInfoViewport(document.createElement('div'))
  })

  afterEach(() => {
    viewport.remove()
  })

  it('renders the corner preview after each frame in the editing view', () => {
    stub.runPostRender()

    expect(stub.renderer.render).toHaveBeenCalledOnce()
  })

  it('renders the preview for an orthographic subject camera too', () => {
    viewport.applyState({
      ...viewport.overlay.getState(),
      cameraType: 'orthographic'
    })
    stub.renderer.render.mockClear()

    stub.runPostRender()

    expect(stub.renderer.render).toHaveBeenCalledOnce()
  })

  it('skips the corner preview while looking through', () => {
    viewport.setLookThrough(true)
    stub.renderer.render.mockClear()

    stub.runPostRender()

    expect(stub.renderer.render).not.toHaveBeenCalled()
  })
})

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

describe('CameraInfoViewport look-through drag', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rotates the subject on left-drag while looking through', () => {
    const stub = makeViewportStub()
    createViewport3dMock.mockReturnValue(stub)
    const onHandleDrag = vi.fn()
    const viewport = new CameraInfoViewport(
      document.createElement('div'),
      undefined,
      { onHandleDrag }
    )

    viewport.setLookThrough(true)
    dispatchPointer(stub.domElement, 'pointerdown', 100, 100)
    dispatchPointer(stub.domElement, 'pointermove', 140, 100)

    expect(onHandleDrag).toHaveBeenCalledWith('mode.yaw', expect.any(Number))

    viewport.remove()
  })

  it('dollies the subject on wheel while looking through', () => {
    const stub = makeViewportStub()
    createViewport3dMock.mockReturnValue(stub)
    const onHandleDrag = vi.fn()
    const viewport = new CameraInfoViewport(
      document.createElement('div'),
      undefined,
      { onHandleDrag }
    )

    viewport.setLookThrough(true)
    stub.domElement.dispatchEvent(new WheelEvent('wheel', { deltaY: -100 }))

    expect(onHandleDrag).toHaveBeenCalledWith(
      'mode.distance',
      expect.any(Number)
    )

    viewport.remove()
  })

  it('ignores the wheel when not looking through', () => {
    const stub = makeViewportStub()
    createViewport3dMock.mockReturnValue(stub)
    const onHandleDrag = vi.fn()
    const viewport = new CameraInfoViewport(
      document.createElement('div'),
      undefined,
      { onHandleDrag }
    )

    stub.domElement.dispatchEvent(new WheelEvent('wheel', { deltaY: -100 }))

    expect(onHandleDrag).not.toHaveBeenCalled()

    viewport.remove()
  })

  it('does not rotate on drag once look-through is exited', () => {
    const stub = makeViewportStub()
    createViewport3dMock.mockReturnValue(stub)
    const onHandleDrag = vi.fn()
    const viewport = new CameraInfoViewport(
      document.createElement('div'),
      undefined,
      { onHandleDrag }
    )

    viewport.setLookThrough(true)
    viewport.setLookThrough(false)
    dispatchPointer(stub.domElement, 'pointerdown', 100, 100)
    dispatchPointer(stub.domElement, 'pointermove', 140, 100)

    expect(onHandleDrag).not.toHaveBeenCalled()

    viewport.remove()
  })
})

describe('CameraInfoViewport gizmo drag callbacks', () => {
  function controlsOf(handle: unknown): {
    dispatchEvent(e: { type: string }): void
  } {
    return (
      handle as { controls: { dispatchEvent(e: { type: string }): void } }
    ).controls
  }

  it('writes camera position fields when the camera handle changes', () => {
    const stub = makeViewportStub()
    createViewport3dMock.mockReturnValue(stub)
    const onHandleDrag = vi.fn()
    const viewport = new CameraInfoViewport(
      document.createElement('div'),
      undefined,
      { onHandleDrag }
    )
    viewport.applyState({ ...viewport.overlay.getState(), mode: 'quaternion' })

    controlsOf(viewport.cameraHandle).dispatchEvent({ type: 'objectChange' })

    for (const axis of ['x', 'y', 'z']) {
      expect(onHandleDrag).toHaveBeenCalledWith(
        `mode.position_${axis}`,
        expect.any(Number)
      )
    }

    viewport.remove()
  })

  it('writes quaternion fields when the camera handle rotates', () => {
    const stub = makeViewportStub()
    createViewport3dMock.mockReturnValue(stub)
    const onHandleDrag = vi.fn()
    const viewport = new CameraInfoViewport(
      document.createElement('div'),
      undefined,
      { onHandleDrag }
    )
    viewport.applyState({ ...viewport.overlay.getState(), mode: 'quaternion' })
    viewport.setTransformGizmoMode('camera-rotate')

    controlsOf(viewport.cameraHandle).dispatchEvent({ type: 'objectChange' })

    expect(onHandleDrag).toHaveBeenCalledWith('mode.quat_w', expect.any(Number))

    viewport.remove()
  })

  it('writes target fields when the target handle changes', () => {
    const stub = makeViewportStub()
    createViewport3dMock.mockReturnValue(stub)
    const onHandleDrag = vi.fn()
    const viewport = new CameraInfoViewport(
      document.createElement('div'),
      undefined,
      { onHandleDrag }
    )

    controlsOf(viewport.targetHandle).dispatchEvent({ type: 'objectChange' })

    for (const axis of ['x', 'y', 'z']) {
      expect(onHandleDrag).toHaveBeenCalledWith(
        `target_${axis}`,
        expect.any(Number)
      )
    }

    viewport.remove()
  })

  it('toggles orbit controls while a handle drag is active', () => {
    const stub = makeViewportStub()
    createViewport3dMock.mockReturnValue(stub)
    const viewport = new CameraInfoViewport(document.createElement('div'))

    controlsOf(viewport.targetHandle).dispatchEvent({
      type: 'dragging-changed',
      value: true
    } as { type: string })
    expect(stub.controlsManager.controls.enabled).toBe(false)

    controlsOf(viewport.targetHandle).dispatchEvent({
      type: 'dragging-changed',
      value: false
    } as { type: string })
    expect(stub.controlsManager.controls.enabled).toBe(true)

    viewport.remove()
  })
})
