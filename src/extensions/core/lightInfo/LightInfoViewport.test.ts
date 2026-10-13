import * as THREE from 'three'
import type { TransformControls } from 'three/examples/jsm/controls/TransformControls'
import { assert, describe, expect, it, vi } from 'vitest'

import type { SceneOverlay } from '@/extensions/core/load3d/interfaces'

import {
  LightInfoViewport,
  lightPositionApplies,
  targetApplies
} from './LightInfoViewport'
import type { LightTransformGizmoMode } from './LightInfoViewport'
import type { TargetHandle } from '@/extensions/core/cameraInfo/handles/TargetHandle'
import { createDefaultLight } from './types'
import type { LightInfoEntry, LightInfoType } from './types'

const { createViewport3dMock } = vi.hoisted(() => ({
  createViewport3dMock: vi.fn()
}))

vi.mock(import('@/extensions/core/load3d/createViewport3d'), () => ({
  createViewport3d: createViewport3dMock
}))

const WIDTH = 800
const HEIGHT = 600

const sideLight: LightInfoEntry = {
  ...createDefaultLight('directional'),
  position: { x: 1.8, y: 1.8, z: 0 },
  target: { x: 0, y: 0, z: 0 }
}

const pointLight: LightInfoEntry = {
  ...createDefaultLight('point'),
  position: { x: -1.2, y: 2, z: 1.2 }
}

function makeCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  Object.defineProperty(canvas, 'clientWidth', { value: WIDTH })
  Object.defineProperty(canvas, 'clientHeight', { value: HEIGHT })
  canvas.getBoundingClientRect = () => new DOMRect(0, 0, WIDTH, HEIGHT)
  canvas.setPointerCapture = vi.fn()
  canvas.releasePointerCapture = vi.fn()
  canvas.hasPointerCapture = vi.fn(() => false)
  return canvas
}

function makeViewportStub() {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(35, WIDTH / HEIGHT, 0.1, 100)
  camera.position.set(0, 6, 8)
  camera.lookAt(0, -0.5, 0)
  camera.updateMatrixWorld()
  const stub = {
    sceneManager: { scene, toggleGrid: vi.fn() },
    cameraManager: { activeCamera: camera },
    controlsManager: { controls: { enabled: true } },
    viewHelperManager: { visibleViewHelper: vi.fn() },
    lightingManager: { setLightIntensity: vi.fn() },
    renderer: { shadowMap: { enabled: false, type: THREE.BasicShadowMap } },
    domElement: makeCanvas(),
    setOverlay: vi.fn((overlay: SceneOverlay) => overlay.attach(scene)),
    setCameraState: vi.fn(),
    forceRender: vi.fn(),
    remove: vi.fn()
  }
  createViewport3dMock.mockReturnValue(stub)
  return stub
}

function setup(
  lights: LightInfoEntry[],
  options: {
    onLightsChange?: (lights: LightInfoEntry[]) => void
    onSelectLight?: (index: number) => void
  } = {}
) {
  const stub = makeViewportStub()
  const viewport = new LightInfoViewport(
    document.createElement('div'),
    lights,
    options
  )
  viewport.applyLights(lights, 0)
  return { stub, viewport }
}

type Stub = ReturnType<typeof makeViewportStub>

function pointer(
  stub: Stub,
  type: string,
  world: THREE.Vector3Like,
  button = 0
): void {
  const ndc = new THREE.Vector3(world.x, world.y, world.z).project(
    stub.cameraManager.activeCamera
  )
  stub.domElement.dispatchEvent(
    new PointerEvent(type, {
      clientX: ((ndc.x + 1) / 2) * WIDTH,
      clientY: ((1 - ndc.y) / 2) * HEIGHT,
      button,
      pointerId: 1,
      bubbles: true
    })
  )
}

function gizmoControls(handle: TargetHandle): TransformControls {
  return (handle as unknown as { controls: TransformControls }).controls
}

function lastLights(
  onLightsChange: ReturnType<typeof vi.fn>
): LightInfoEntry[] {
  const call = onLightsChange.mock.lastCall
  assert.exists(call)
  return call[0]
}

function rounded(position: THREE.Vector3Like): number[] {
  return [position.x, position.y, position.z].map(
    (v) => Math.round(v * 1000) / 1000 + 0
  )
}

const YAW_HANDLE = { x: 1.5, y: 0, z: 0 }
const PITCH_HANDLE = { x: 1.5 * Math.SQRT1_2, y: 1.5 * Math.SQRT1_2, z: 0 }
const DISTANCE_HANDLE = sideLight.position

describe('lightPositionApplies / targetApplies', () => {
  it.for([
    { type: 'directional', position: false, target: true },
    { type: 'point', position: true, target: false },
    { type: 'spot', position: true, target: true }
  ] satisfies { type: LightInfoType; position: boolean; target: boolean }[])(
    'a $type light is positionable=$position and aimable=$target',
    ({ type, position, target }) => {
      expect([lightPositionApplies(type), targetApplies(type)]).toEqual([
        position,
        target
      ])
    }
  )
})

describe('LightInfoViewport gizmo visibility', () => {
  it.for([
    {
      type: 'directional',
      mode: 'none',
      visible: { orbit: true, position: false, target: false }
    },
    {
      type: 'directional',
      mode: 'target',
      visible: { orbit: true, position: false, target: true }
    },
    {
      type: 'point',
      mode: 'light-position',
      visible: { orbit: false, position: true, target: false }
    },
    {
      type: 'point',
      mode: 'target',
      visible: { orbit: false, position: false, target: false }
    },
    {
      type: 'spot',
      mode: 'target',
      visible: { orbit: false, position: false, target: true }
    }
  ] satisfies {
    type: LightInfoType
    mode: LightTransformGizmoMode
    visible: { orbit: boolean; position: boolean; target: boolean }
  }[])(
    'shows the right gizmos for a $type light in $mode mode',
    ({ type, mode, visible }) => {
      const { viewport } = setup([createDefaultLight(type)])

      viewport.setTransformGizmoMode(mode)

      expect({
        orbit: viewport.orbitHandles.isVisible(),
        position: viewport.positionHandle.isVisible(),
        target: viewport.targetHandle.isVisible()
      }).toEqual(visible)
    }
  )

  it('hides the orbit handles when gizmos are turned off', () => {
    const { viewport } = setup([sideLight])

    viewport.setGizmosVisible(false)

    expect(viewport.orbitHandles.isVisible()).toBe(false)
  })

  it.for([
    { type: 'point', mode: 'light-position', handle: 'positionHandle' },
    { type: 'spot', mode: 'target', handle: 'targetHandle' }
  ] satisfies {
    type: LightInfoType
    mode: LightTransformGizmoMode
    handle: 'positionHandle' | 'targetHandle'
  }[])(
    'keeps the $mode handle hidden and inert while gizmos are off',
    ({ type, mode, handle }) => {
      const { viewport } = setup([createDefaultLight(type)])
      const isActive = () =>
        viewport[handle].isVisible() && gizmoControls(viewport[handle]).enabled

      viewport.setTransformGizmoMode(mode)
      viewport.setGizmosVisible(false)
      expect(isActive()).toBe(false)

      viewport.setGizmosVisible(true)
      expect(isActive()).toBe(true)

      viewport.setTransformGizmoMode('none')
      viewport.setGizmosVisible(false)
      viewport.setTransformGizmoMode(mode)
      expect(isActive()).toBe(false)
    }
  )
})

describe('LightInfoViewport orbit handle drag', () => {
  it.for([
    {
      handle: 'yaw',
      from: YAW_HANDLE,
      to: { x: 0, y: 0, z: 1.5 },
      expected: [0, 1.8, 1.8]
    },
    {
      handle: 'pitch',
      from: PITCH_HANDLE,
      to: { x: 1, y: 0, z: 0 },
      expected: [2.546, 0, 0]
    },
    {
      handle: 'distance',
      from: DISTANCE_HANDLE,
      to: { x: 2.5, y: 2.5, z: 0 },
      expected: [2.5, 2.5, 0]
    }
  ])(
    're-aims the light when the $handle handle is dragged',
    ({ from, to, expected }) => {
      const onLightsChange = vi.fn()
      const { stub } = setup([sideLight], { onLightsChange })

      pointer(stub, 'pointerdown', from)
      pointer(stub, 'pointermove', to)

      expect(rounded(lastLights(onLightsChange)[0].position)).toEqual(expected)
    }
  )

  it('suspends orbit controls for the duration of a handle drag', () => {
    const { stub } = setup([sideLight])

    pointer(stub, 'pointerdown', YAW_HANDLE)
    expect(stub.controlsManager.controls.enabled).toBe(false)

    pointer(stub, 'pointerup', YAW_HANDLE)
    expect(stub.controlsManager.controls.enabled).toBe(true)
  })

  it('keeps orbit controls off after a handle drag while the camera is locked', () => {
    const { stub, viewport } = setup([sideLight])
    viewport.setCameraLocked(true)

    pointer(stub, 'pointerdown', YAW_HANDLE)
    pointer(stub, 'pointerup', YAW_HANDLE)

    expect(stub.controlsManager.controls.enabled).toBe(false)
  })

  it.for([
    { label: 'a right-button press', button: 2, gizmos: true },
    { label: 'hidden gizmos', button: 0, gizmos: false }
  ])('ignores handle drags with $label', ({ button, gizmos }) => {
    const onLightsChange = vi.fn()
    const { stub, viewport } = setup([sideLight], { onLightsChange })
    viewport.setGizmosVisible(gizmos)

    pointer(stub, 'pointerdown', YAW_HANDLE, button)
    pointer(stub, 'pointermove', { x: 0, y: 0, z: 1.5 })

    expect(onLightsChange).not.toHaveBeenCalled()
  })
})

describe('LightInfoViewport hover and selection', () => {
  it.for([
    { over: 'an orbit handle', at: YAW_HANDLE, cursor: 'grab' },
    { over: 'another light', at: pointLight.position, cursor: 'pointer' },
    { over: 'empty floor', at: { x: -3, y: 0, z: -3 }, cursor: '' }
  ])('shows a "$cursor" cursor over $over', ({ at, cursor }) => {
    const { stub } = setup([sideLight, pointLight])

    pointer(stub, 'pointermove', at)

    expect(stub.domElement.style.cursor).toBe(cursor)
  })

  it('clears the hover cursor when the pointer leaves the canvas', () => {
    const { stub } = setup([sideLight, pointLight])
    pointer(stub, 'pointermove', YAW_HANDLE)

    pointer(stub, 'pointerleave', YAW_HANDLE)

    expect(stub.domElement.style.cursor).toBe('')
  })

  it('selects another light when its marker is clicked', () => {
    const onSelectLight = vi.fn()
    const { stub, viewport } = setup([sideLight, pointLight], {
      onSelectLight
    })

    pointer(stub, 'pointerdown', pointLight.position)

    expect(onSelectLight).toHaveBeenCalledWith(1)
    expect(viewport.overlay.getSelectedIndex()).toBe(1)
  })
})

describe('LightInfoViewport transform gizmos', () => {
  it.for([
    {
      gizmo: 'position',
      light: pointLight,
      expected: { position: { x: 3, y: 1, z: -2 } }
    },
    {
      gizmo: 'target',
      light: createDefaultLight('spot'),
      expected: { target: { x: 3, y: 1, z: -2 } }
    }
  ] as const)(
    'writes the dragged $gizmo back to the selected light',
    ({ gizmo, light, expected }) => {
      const onLightsChange = vi.fn()
      const { stub, viewport } = setup([light], { onLightsChange })
      const handle =
        gizmo === 'position' ? viewport.positionHandle : viewport.targetHandle
      const name =
        gizmo === 'position' ? 'LightInfoPositionProxy' : 'LightInfoTargetProxy'
      const proxy = stub.sceneManager.scene.getObjectByName(name)
      assert.exists(proxy)

      proxy.position.set(3, 1, -2)
      gizmoControls(handle).dispatchEvent({ type: 'objectChange' })

      expect(lastLights(onLightsChange)).toEqual([{ ...light, ...expected }])
    }
  )

  it('ignores gizmo moves when there is no light to edit', () => {
    const onLightsChange = vi.fn()
    const { viewport } = setup([], { onLightsChange })

    gizmoControls(viewport.positionHandle).dispatchEvent({
      type: 'objectChange'
    })

    expect(onLightsChange).not.toHaveBeenCalled()
  })

  it.for([
    { locked: false, enabled: true },
    { locked: true, enabled: false }
  ])(
    'restores orbit controls to $enabled after a gizmo drag when locked=$locked',
    ({ locked, enabled }) => {
      const { stub, viewport } = setup([pointLight])
      viewport.setCameraLocked(locked)
      const controls = gizmoControls(viewport.positionHandle)

      controls.dispatchEvent({ type: 'dragging-changed', value: true })
      expect(stub.controlsManager.controls.enabled).toBe(false)

      controls.dispatchEvent({ type: 'dragging-changed', value: false })
      expect(stub.controlsManager.controls.enabled).toBe(enabled)
    }
  )
})

describe('LightInfoViewport camera', () => {
  it('moves the camera back to the default RenderLight view', () => {
    const { stub, viewport } = setup([sideLight])

    viewport.resetViewToOutput()

    expect(stub.setCameraState).toHaveBeenCalledWith({
      position: new THREE.Vector3(0, 6, 8),
      target: new THREE.Vector3(0, -0.5, 0),
      zoom: 1,
      cameraType: 'perspective',
      fov: 35
    })
  })

  it('stops handling pointer input and tears down its gizmos on remove', () => {
    const onSelectLight = vi.fn()
    const { stub, viewport } = setup([sideLight, pointLight], {
      onSelectLight
    })

    viewport.remove()
    pointer(stub, 'pointerdown', pointLight.position)

    expect(onSelectLight).not.toHaveBeenCalled()
    expect(stub.remove).toHaveBeenCalledOnce()
    expect(
      stub.sceneManager.scene.getObjectByName('LightInfoOrbitHandles')
    ).toBeUndefined()
  })
})
