import * as THREE from 'three'
import type { TransformControls } from 'three/examples/jsm/controls/TransformControls'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CameraHandle } from './CameraHandle'
import type { CameraHandleMode, CameraHandleTransform } from './CameraHandle'

describe('CameraHandle', () => {
  let scene: THREE.Scene
  let camera: THREE.PerspectiveCamera
  let dom: HTMLElement
  let onDragging: (dragging: boolean) => void
  let onDraggingMock: ReturnType<typeof vi.fn>
  let onChange: (
    transform: CameraHandleTransform,
    mode: CameraHandleMode
  ) => void
  let onChangeMock: ReturnType<typeof vi.fn>
  let handle: CameraHandle

  beforeEach(() => {
    scene = new THREE.Scene()
    camera = new THREE.PerspectiveCamera()
    dom = document.createElement('div')
    onDraggingMock = vi.fn()
    onDragging = onDraggingMock as unknown as (dragging: boolean) => void
    onChangeMock = vi.fn()
    onChange = onChangeMock as unknown as (
      transform: CameraHandleTransform,
      mode: CameraHandleMode
    ) => void
    handle = new CameraHandle(camera, dom, onDragging, onChange)
    handle.attach(scene)
  })

  function controls(): TransformControls {
    return (handle as unknown as { controls: TransformControls }).controls
  }

  afterEach(() => {
    handle.dispose()
  })

  it('adds a proxy + a helper to the scene on attach', () => {
    expect(
      scene.children.find((c) => c.name === 'CameraInfoCameraProxy')
    ).toBeDefined()
    expect(
      scene.children.find((c) => c.name === 'CameraInfoCameraHandle')
    ).toBeDefined()
  })

  it('starts hidden with controls disabled', () => {
    expect(handle.isVisible()).toBe(false)
    expect(controls().enabled).toBe(false)
  })

  it('defaults to translate mode', () => {
    expect(handle.getMode()).toBe('translate')
  })

  it('setMode switches translate <-> rotate', () => {
    handle.setMode('rotate')
    expect(handle.getMode()).toBe('rotate')

    handle.setMode('translate')
    expect(handle.getMode()).toBe('translate')
  })

  it('setSubject moves the proxy to the given pose without firing onChange', () => {
    handle.setSubject({ x: 1, y: 2, z: 3 }, { x: 0, y: 0, z: 0, w: 1 })

    const proxy = scene.children.find(
      (c) => c.name === 'CameraInfoCameraProxy'
    )!
    expect(proxy.position.x).toBe(1)
    expect(proxy.position.y).toBe(2)
    expect(proxy.position.z).toBe(3)
    expect(onChangeMock).not.toHaveBeenCalled()
  })

  it('setSubject is a no-op when the pose already matches', () => {
    handle.setSubject({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0, w: 1 })
    onChangeMock.mockClear()

    handle.setSubject({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0, w: 1 })

    expect(onChangeMock).not.toHaveBeenCalled()
  })

  it('setVisible toggles helper.visible and controls.enabled together', () => {
    handle.setVisible(true)
    expect(handle.isVisible()).toBe(true)
    expect(controls().enabled).toBe(true)

    handle.setVisible(false)
    expect(handle.isVisible()).toBe(false)
    expect(controls().enabled).toBe(false)
  })

  it('emits the proxy transform and active mode on gizmo objectChange', () => {
    const proxy = scene.children.find(
      (c) => c.name === 'CameraInfoCameraProxy'
    )!
    proxy.position.set(1, 2, 3)

    controls().dispatchEvent({ type: 'objectChange' })

    expect(onChangeMock).toHaveBeenCalledWith(
      expect.objectContaining({ position: { x: 1, y: 2, z: 3 } }),
      'translate'
    )
  })

  it('forwards dragging-changed to the dragging listener', () => {
    controls().dispatchEvent({ type: 'dragging-changed', value: true })

    expect(onDraggingMock).toHaveBeenCalledWith(true)
  })

  it('dispose removes proxy and helper from the scene', () => {
    handle.dispose()
    expect(
      scene.children.find((c) => c.name === 'CameraInfoCameraProxy')
    ).toBeUndefined()
    expect(
      scene.children.find((c) => c.name === 'CameraInfoCameraHandle')
    ).toBeUndefined()
  })
})
