import * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DEFAULT_CAMERA_INFO_STATE } from '../types'
import { RollHandle } from './RollHandle'

describe('RollHandle', () => {
  let scene: THREE.Scene
  let handle: RollHandle

  beforeEach(() => {
    scene = new THREE.Scene()
    handle = new RollHandle()
    handle.attach(scene)
  })

  afterEach(() => {
    handle.dispose()
  })

  it('attaches a single root group to the scene', () => {
    expect(
      scene.children.find((c) => c.name === 'CameraInfoRollHandle')
    ).toBeDefined()
  })

  it('exposes one pickable mesh tagged handleType="roll"', () => {
    const meshes = handle.pickableMeshes()
    expect(meshes).toHaveLength(1)
    expect(meshes[0].userData.handleType).toBe('roll')
  })

  it('hides itself in quaternion mode (rotate gizmo owns roll there)', () => {
    handle.update({ ...DEFAULT_CAMERA_INFO_STATE, mode: 'quaternion' })

    expect(handle.isVisible()).toBe(false)
  })

  it('is visible in orbit and look_at modes', () => {
    handle.update({ ...DEFAULT_CAMERA_INFO_STATE, mode: 'orbit' })
    expect(handle.isVisible()).toBe(true)

    handle.update({ ...DEFAULT_CAMERA_INFO_STATE, mode: 'look_at' })
    expect(handle.isVisible()).toBe(true)
  })

  it('setVisible forces visibility', () => {
    handle.update({ ...DEFAULT_CAMERA_INFO_STATE, mode: 'orbit' })
    handle.setVisible(false)

    expect(handle.isVisible()).toBe(false)
  })

  it('positions itself at the target', () => {
    handle.update({
      ...DEFAULT_CAMERA_INFO_STATE,
      mode: 'orbit',
      target: { x: 1, y: 2, z: 3 }
    })

    const root = scene.children.find((c) => c.name === 'CameraInfoRollHandle')!
    expect(root.position.x).toBeCloseTo(1)
    expect(root.position.y).toBeCloseTo(2)
    expect(root.position.z).toBeCloseTo(3)
  })

  it('places the pickable handle on the +right axis at roll=90', () => {
    handle.update({
      ...DEFAULT_CAMERA_INFO_STATE,
      mode: 'look_at',
      target: { x: 0, y: 0, z: 0 },
      lookAt: { position: { x: 0, y: 0, z: 5 } },
      roll: 90
    })

    const world = new THREE.Vector3()
    handle.pickableMeshes()[0].getWorldPosition(world)
    expect(world.x).toBeCloseTo(0.9)
    expect(world.y).toBeCloseTo(0)
    expect(world.z).toBeCloseTo(0)
  })

  it('places the pickable handle on the +up axis at roll=0', () => {
    handle.update({
      ...DEFAULT_CAMERA_INFO_STATE,
      mode: 'look_at',
      target: { x: 0, y: 0, z: 0 },
      lookAt: { position: { x: 0, y: 0, z: 5 } },
      roll: 0
    })

    const world = new THREE.Vector3()
    handle.pickableMeshes()[0].getWorldPosition(world)
    expect(world.x).toBeCloseTo(0)
    expect(world.y).toBeCloseTo(0.9)
    expect(world.z).toBeCloseTo(0)
  })

  it('drag plane normal points along the camera→target backward direction', () => {
    const plane = handle.dragPlane({
      ...DEFAULT_CAMERA_INFO_STATE,
      mode: 'look_at',
      target: { x: 0, y: 0, z: 0 },
      lookAt: { position: { x: 0, y: 0, z: 5 } }
    })
    expect(plane.normal.x).toBeCloseTo(0)
    expect(plane.normal.y).toBeCloseTo(0)
    expect(Math.abs(plane.normal.z)).toBeCloseTo(1)
  })
})
