import * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DEFAULT_CAMERA_INFO_STATE } from '../types'
import { OrbitHandles } from './OrbitHandles'

describe('OrbitHandles', () => {
  let scene: THREE.Scene
  let handles: OrbitHandles

  beforeEach(() => {
    scene = new THREE.Scene()
    handles = new OrbitHandles()
    handles.attach(scene)
  })

  afterEach(() => {
    handles.dispose()
  })

  it('adds a single root group to the scene on attach', () => {
    const root = scene.children.find((c) => c.name === 'CameraInfoOrbitHandles')
    expect(root).toBeDefined()
  })

  it('exposes three pickable handle meshes tagged with handleType', () => {
    const meshes = handles.pickableMeshes()
    expect(meshes).toHaveLength(3)
    const types = meshes.map((m) => m.userData.handleType).sort()
    expect(types).toEqual(['distance', 'pitch', 'yaw'])
  })

  it('positions the yaw handle on the +Z side of the ring at yaw=0', () => {
    handles.update({
      ...DEFAULT_CAMERA_INFO_STATE,
      mode: 'orbit',
      orbit: { yaw: 0, pitch: 0, distance: 5 }
    })

    const yawHandle = handles
      .pickableMeshes()
      .find((m) => m.userData.handleType === 'yaw')!
    expect(yawHandle.position.x).toBeCloseTo(0)
    expect(yawHandle.position.z).toBeCloseTo(1.5)
  })

  it('places the distance handle at the camera (distance along yaw direction)', () => {
    handles.update({
      ...DEFAULT_CAMERA_INFO_STATE,
      mode: 'orbit',
      target: { x: 0, y: 0, z: 0 },
      orbit: { yaw: 90, pitch: 0, distance: 7 }
    })

    const distanceHandle = handles
      .pickableMeshes()
      .find((m) => m.userData.handleType === 'distance')!
    const world = new THREE.Vector3()
    distanceHandle.getWorldPosition(world)
    expect(world.x).toBeCloseTo(7)
    expect(world.y).toBeCloseTo(0)
    expect(world.z).toBeCloseTo(0)
  })

  it('places the distance handle along a nonzero-pitch camera direction', () => {
    handles.update({
      ...DEFAULT_CAMERA_INFO_STATE,
      mode: 'orbit',
      target: { x: 0, y: 0, z: 0 },
      orbit: { yaw: 0, pitch: 45, distance: 10 }
    })

    const distanceHandle = handles
      .pickableMeshes()
      .find((m) => m.userData.handleType === 'distance')!
    const world = new THREE.Vector3()
    distanceHandle.getWorldPosition(world)
    expect(world.x).toBeCloseTo(0)
    expect(world.y).toBeCloseTo(10 * Math.SQRT1_2)
    expect(world.z).toBeCloseTo(10 * Math.SQRT1_2)
  })

  it('hides itself in non-orbit modes', () => {
    handles.update({ ...DEFAULT_CAMERA_INFO_STATE, mode: 'look_at' })

    const root = scene.children.find(
      (c) => c.name === 'CameraInfoOrbitHandles'
    )!
    expect(root.visible).toBe(false)
  })

  it('setVisible forces visibility independent of mode', () => {
    handles.update({ ...DEFAULT_CAMERA_INFO_STATE, mode: 'orbit' })
    handles.setVisible(false)

    const root = scene.children.find(
      (c) => c.name === 'CameraInfoOrbitHandles'
    )!
    expect(root.visible).toBe(false)
  })

  it('reports not visible in quaternion mode', () => {
    handles.update({ ...DEFAULT_CAMERA_INFO_STATE, mode: 'quaternion' })

    expect(handles.isVisible()).toBe(false)
  })

  it('yaw drag plane is horizontal through target', () => {
    const plane = handles.dragPlaneFor('yaw', {
      ...DEFAULT_CAMERA_INFO_STATE,
      target: { x: 0, y: 3, z: 0 }
    })
    expect(plane.normal.y).toBeCloseTo(1)
    expect(plane.constant).toBeCloseTo(-3)
  })

  it('pitch drag plane is vertical and orthogonal to yaw direction', () => {
    const plane = handles.dragPlaneFor('pitch', {
      ...DEFAULT_CAMERA_INFO_STATE,
      orbit: { yaw: 0, pitch: 0, distance: 5 }
    })
    expect(Math.abs(plane.normal.x)).toBeCloseTo(1)
    expect(plane.normal.y).toBeCloseTo(0)
  })
})
