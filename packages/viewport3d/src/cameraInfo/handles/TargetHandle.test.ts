import * as THREE from 'three'
import type { TransformControls } from 'three/examples/jsm/controls/TransformControls'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TargetHandle } from './TargetHandle'

function gizmoControls(handle: unknown): TransformControls {
  return (handle as { controls: TransformControls }).controls
}

describe('TargetHandle', () => {
  let scene: THREE.Scene
  let onDragging: ReturnType<typeof vi.fn<(dragging: boolean) => void>>
  let onChange: ReturnType<typeof vi.fn<(target: THREE.Vector3Like) => void>>
  let handle: TargetHandle

  beforeEach(() => {
    scene = new THREE.Scene()
    onDragging = vi.fn()
    onChange = vi.fn()
    handle = new TargetHandle(
      new THREE.PerspectiveCamera(),
      document.createElement('div'),
      onDragging,
      onChange
    )
    handle.attach(scene)
  })

  afterEach(() => {
    handle.dispose()
  })

  function proxy(): THREE.Object3D {
    return scene.children.find((c) => c.name === 'CameraInfoTargetProxy')!
  }

  function controls(): TransformControls {
    return gizmoControls(handle)
  }

  it('adds proxy + helper to the scene on attach', () => {
    expect(proxy()).toBeDefined()
    expect(
      scene.children.find((c) => c.name === 'CameraInfoTargetHandle')
    ).toBeDefined()
  })

  it('starts hidden and toggles visibility', () => {
    expect(handle.isVisible()).toBe(false)
    handle.setVisible(true)
    expect(handle.isVisible()).toBe(true)
  })

  it('setTarget moves the proxy without echoing onChange', () => {
    handle.setTarget({ x: 1, y: 2, z: 3 })

    expect(proxy().position.toArray()).toEqual([1, 2, 3])
    expect(onChange).not.toHaveBeenCalled()
  })

  it('setTarget is a no-op when the position already matches', () => {
    handle.setTarget({ x: 1, y: 2, z: 3 })
    handle.setTarget({ x: 1, y: 2, z: 3 })

    expect(proxy().position.toArray()).toEqual([1, 2, 3])
    expect(onChange).not.toHaveBeenCalled()
  })

  it('emits onChange with the proxy position on gizmo objectChange', () => {
    proxy().position.set(4, 5, 6)
    controls().dispatchEvent({ type: 'objectChange' })

    expect(onChange).toHaveBeenCalledWith({ x: 4, y: 5, z: 6 })
  })

  it('forwards dragging-changed to onDraggingChange', () => {
    controls().dispatchEvent({ type: 'dragging-changed', value: true })

    expect(onDragging).toHaveBeenCalledWith(true)
  })

  it('dispose removes proxy and helper', () => {
    handle.dispose()

    expect(proxy()).toBeUndefined()
    expect(
      scene.children.find((c) => c.name === 'CameraInfoTargetHandle')
    ).toBeUndefined()
  })
})
