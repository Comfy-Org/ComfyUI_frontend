import * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createViewport3dMock } = vi.hoisted(() => ({
  createViewport3dMock: vi.fn()
}))

vi.mock(import('#/load3d/createViewport3d'), () => ({
  createViewport3d: createViewport3dMock
}))

import type { Load3dHost } from '#/load3d/interfaces'

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
    sceneManager: {
      scene: new THREE.Scene(),
      gridHelper: new THREE.GridHelper()
    },
    cameraManager: { activeCamera: new THREE.PerspectiveCamera() },
    controlsManager: {
      controls: { enabled: true, target: new THREE.Vector3(), update: vi.fn() }
    },
    viewHelperManager: { visibleViewHelper: vi.fn() },
    rendererView: {
      setViewport: vi.fn(),
      setScissor: vi.fn(),
      setScissorTest: vi.fn()
    },
    renderer: {
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

describe('CameraInfoViewport subject model', () => {
  const TRIANGLE_STL = `solid triangle
facet normal 0 0 1
outer loop
vertex 0 0 0
vertex 2 0 0
vertex 0 2 0
endloop
endfacet
endsolid triangle`
  const source = { rootFolder: 'input', subfolder: '3d', filename: 'a.stl' }

  let stub: ReturnType<typeof makeViewportStub>
  let viewport: CameraInfoViewport

  function hostServing(respond: () => Promise<Response>): Load3dHost {
    return {
      fetchApi: vi.fn(respond),
      getPLYEngine: () => 'threejs',
      resolveImageURL: (path) => path
    }
  }

  const servingTriangle = () =>
    hostServing(async () => new Response(TRIANGLE_STL))

  const subjectModel = () =>
    stub.sceneManager.scene.getObjectByName('CameraInfoSubjectModel')

  beforeEach(() => {
    stub = makeViewportStub()
    createViewport3dMock.mockReturnValue(stub)
    viewport = new CameraInfoViewport(document.createElement('div'))
    viewport.overlay.attach(stub.sceneManager.scene)
  })

  afterEach(() => {
    viewport.remove()
  })

  it('shows the loaded model standing on the grid', async () => {
    const outcome = await viewport.showSubjectModel(servingTriangle(), source)

    expect(outcome).toEqual({ status: 'shown' })
    stub.sceneManager.scene.updateMatrixWorld(true)
    const floor = new THREE.Box3().setFromObject(subjectModel()!, true).min.y
    expect(floor).toBeLessThan(0)
    expect(stub.sceneManager.gridHelper.position.y).toBeCloseTo(floor)
    expect(stub.forceRender).toHaveBeenCalled()
  })

  it('returns to the reference cube and ground when the source is cleared', async () => {
    await viewport.showSubjectModel(servingTriangle(), source)

    const outcome = await viewport.showSubjectModel(servingTriangle(), null)

    expect(outcome).toEqual({ status: 'cleared' })
    expect(subjectModel()).toBeUndefined()
    expect(stub.sceneManager.gridHelper.position.y).toBe(0)
  })

  it('fits the gizmos, axes and editor view to the model, and back', async () => {
    const camera = stub.cameraManager.activeCamera
    camera.position.set(0, 0, 9)
    const { scene } = stub.sceneManager
    const worldRadius = (handle: THREE.Object3D) => {
      scene.updateMatrixWorld(true)
      return handle.getWorldPosition(new THREE.Vector3()).length()
    }
    const yawRadius = () =>
      worldRadius(
        viewport.orbitHandles
          .pickableMeshes()
          .find((m) => m.userData.handleType === 'yaw')!
      )
    const rollRadius = () =>
      worldRadius(viewport.rollHandle.pickableMeshes()[0])
    const axesExtent = () => {
      scene.updateMatrixWorld(true)
      const axes = scene.getObjectByProperty('type', 'AxesHelper')!
      return new THREE.Box3().setFromObject(axes, true).max.x
    }
    const cube = { yaw: yawRadius(), roll: rollRadius(), axes: axesExtent() }
    const fitted = 1 / Math.sqrt(3)

    await viewport.showSubjectModel(servingTriangle(), source)

    expect(yawRadius()).toBeCloseTo(cube.yaw * fitted)
    expect(rollRadius()).toBeCloseTo(cube.roll * fitted)
    expect(axesExtent()).toBeCloseTo(cube.axes * fitted)
    expect(camera.position.z).toBeCloseTo(9 * fitted)

    await viewport.showSubjectModel(servingTriangle(), null)

    expect(yawRadius()).toBeCloseTo(cube.yaw)
    expect(rollRadius()).toBeCloseTo(cube.roll)
    expect(axesExtent()).toBeCloseTo(cube.axes)
    expect(camera.position.z).toBeCloseTo(9)
  })

  it('leaves hidden gizmos hidden when a model arrives or is cleared', async () => {
    viewport.setGizmosVisible(false)

    await viewport.showSubjectModel(servingTriangle(), source)
    expect(viewport.orbitHandles.isVisible()).toBe(false)

    await viewport.showSubjectModel(servingTriangle(), null)
    expect(viewport.orbitHandles.isVisible()).toBe(false)
  })

  it('keeps the reference cube when the file is missing', async () => {
    const missing = hostServing(async () => new Response('', { status: 404 }))

    const outcome = await viewport.showSubjectModel(missing, source)

    expect(outcome).toEqual({ status: 'not-found' })
    expect(subjectModel()).toBeUndefined()
    expect(stub.sceneManager.gridHelper.position.y).toBe(0)
  })

  it('returns to the reference cube with the cause when a load fails', async () => {
    await viewport.showSubjectModel(servingTriangle(), source)
    const broken = hostServing(async () => new Response('', { status: 500 }))

    const outcome = await viewport.showSubjectModel(broken, source)

    expect(outcome).toEqual({ status: 'failed', cause: expect.any(Error) })
    expect(subjectModel()).toBeUndefined()
    expect(stub.sceneManager.gridHelper.position.y).toBe(0)
  })

  it('drops a load that a newer request replaced', async () => {
    let release: (response: Response) => void = () => {}
    const slow = hostServing(
      () => new Promise<Response>((resolve) => (release = resolve))
    )

    const stale = viewport.showSubjectModel(slow, source)
    await viewport.showSubjectModel(servingTriangle(), null)
    release(new Response(TRIANGLE_STL))

    expect(await stale).toEqual({ status: 'cancelled' })
    expect(subjectModel()).toBeUndefined()
  })

  it('drops a load that finishes after the viewport is removed', async () => {
    let release: (response: Response) => void = () => {}
    const slow = hostServing(
      () => new Promise<Response>((resolve) => (release = resolve))
    )

    const pending = viewport.showSubjectModel(slow, source)
    viewport.remove()
    release(new Response(TRIANGLE_STL))
    await pending

    expect(subjectModel()).toBeUndefined()
  })
})
