import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { dollySubjectByWheel, rotateSubjectByDrag } from './lookThroughDragMath'
import { DEFAULT_CAMERA_INFO_STATE } from './types'
import type { CameraInfoState } from './types'

const RAD2DEG = 180 / Math.PI

function stateWith(overrides: Partial<CameraInfoState>): CameraInfoState {
  return { ...structuredClone(DEFAULT_CAMERA_INFO_STATE), ...overrides }
}

describe('rotateSubjectByDrag - orbit', () => {
  it('adds the drag deltas to yaw and pitch in degrees', () => {
    const state = stateWith({ mode: 'orbit' })
    const result = rotateSubjectByDrag(state, 0.1, 0.05)

    expect(result).not.toBeNull()
    expect(result!.nextState.orbit.yaw).toBeCloseTo(
      state.orbit.yaw + 0.1 * RAD2DEG
    )
    expect(result!.nextState.orbit.pitch).toBeCloseTo(
      state.orbit.pitch + 0.05 * RAD2DEG
    )
    expect(result!.updates.map((u) => u.fieldName)).toEqual([
      'mode.yaw',
      'mode.pitch'
    ])
  })

  it('clamps pitch to the pole limit', () => {
    const state = stateWith({
      mode: 'orbit',
      orbit: { yaw: 0, pitch: 80, distance: 4 }
    })
    const result = rotateSubjectByDrag(state, 0, 1)

    expect(result!.nextState.orbit.pitch).toBe(89)
  })
})

describe('rotateSubjectByDrag - look_at', () => {
  it('rotates the target around a fixed camera position, preserving distance', () => {
    const state = stateWith({
      mode: 'look_at',
      lookAt: { position: { x: 0, y: 0, z: 5 } },
      target: { x: 0, y: 0, z: 0 }
    })
    const result = rotateSubjectByDrag(state, 0.2, 0)

    expect(result).not.toBeNull()
    const pos = new THREE.Vector3(0, 0, 5)
    const before = new THREE.Vector3(0, 0, 0).distanceTo(pos)
    const nextTarget = result!.nextState.target
    const after = new THREE.Vector3(
      nextTarget.x,
      nextTarget.y,
      nextTarget.z
    ).distanceTo(pos)

    expect(after).toBeCloseTo(before)
    expect(nextTarget.x).not.toBeCloseTo(0)
    expect(result!.updates.map((u) => u.fieldName)).toEqual([
      'target_x',
      'target_y',
      'target_z'
    ])
  })

  it('returns null when the camera sits on the target', () => {
    const state = stateWith({
      mode: 'look_at',
      lookAt: { position: { x: 1, y: 1, z: 1 } },
      target: { x: 1, y: 1, z: 1 }
    })

    expect(rotateSubjectByDrag(state, 0.1, 0.1)).toBeNull()
  })
})

describe('rotateSubjectByDrag - quaternion', () => {
  it('rotates the orientation and keeps a unit quaternion', () => {
    const state = stateWith({
      mode: 'quaternion',
      quaternion: {
        position: { x: 0, y: 0, z: 5 },
        quat: { x: 0, y: 0, z: 0, w: 1 }
      }
    })
    const result = rotateSubjectByDrag(state, 0.2, 0.1)

    expect(result).not.toBeNull()
    const q = result!.nextState.quaternion.quat
    const length = Math.hypot(q.x, q.y, q.z, q.w)
    expect(length).toBeCloseTo(1)
    expect(q).not.toEqual({ x: 0, y: 0, z: 0, w: 1 })
    expect(result!.nextState.quaternion.position).toEqual({ x: 0, y: 0, z: 5 })
    expect(result!.updates.map((u) => u.fieldName)).toEqual([
      'mode.quat_x',
      'mode.quat_y',
      'mode.quat_z',
      'mode.quat_w'
    ])
  })

  it('treats a zero-length quaternion as identity', () => {
    const state = stateWith({
      mode: 'quaternion',
      quaternion: {
        position: { x: 0, y: 0, z: 0 },
        quat: { x: 0, y: 0, z: 0, w: 0 }
      }
    })
    const result = rotateSubjectByDrag(state, 0.1, 0)
    const q = result!.nextState.quaternion.quat

    expect(Math.hypot(q.x, q.y, q.z, q.w)).toBeCloseTo(1)
  })

  it('yaw-only rotates forward around world Y, keeping the horizon level', () => {
    const state = stateWith({
      mode: 'quaternion',
      quaternion: {
        position: { x: 0, y: 0, z: 0 },
        quat: { x: 0, y: 0, z: 0, w: 1 }
      }
    })
    const q = quatFrom(rotateSubjectByDrag(state, 0.3, 0))
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(q)
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q)

    expect(forward.y).toBeCloseTo(0)
    expect(up.y).toBeCloseTo(1)
    expect(forward.x).toBeLessThan(0)
  })

  it('pitch-only tilts forward up', () => {
    const state = stateWith({
      mode: 'quaternion',
      quaternion: {
        position: { x: 0, y: 0, z: 0 },
        quat: { x: 0, y: 0, z: 0, w: 1 }
      }
    })
    const q = quatFrom(rotateSubjectByDrag(state, 0, 0.3))
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(q)

    expect(forward.y).toBeGreaterThan(0)
  })
})

function quatFrom(
  result: ReturnType<typeof rotateSubjectByDrag>
): THREE.Quaternion {
  const { x, y, z, w } = result!.nextState.quaternion.quat
  return new THREE.Quaternion(x, y, z, w)
}

describe('dollySubjectByWheel - perspective', () => {
  it('orbit: scrolling up shortens distance, scrolling down lengthens it', () => {
    const state = stateWith({ mode: 'orbit', cameraType: 'perspective' })

    const closer = rotateResultDistance(dollySubjectByWheel(state, -100))
    const farther = rotateResultDistance(dollySubjectByWheel(state, 100))

    expect(closer).toBeLessThan(state.orbit.distance)
    expect(farther).toBeGreaterThan(state.orbit.distance)
  })

  it('orbit: clamps distance to the same bounds as the handle drag', () => {
    const state = stateWith({
      mode: 'orbit',
      orbit: { yaw: 0, pitch: 0, distance: 4 }
    })

    expect(dollySubjectByWheel(state, -100000)!.nextState.orbit.distance).toBe(
      0.5
    )
    expect(dollySubjectByWheel(state, 100000)!.nextState.orbit.distance).toBe(
      100
    )
  })

  it('look_at: moves the position toward the target, preserving direction', () => {
    const state = stateWith({
      mode: 'look_at',
      lookAt: { position: { x: 0, y: 0, z: 5 } },
      target: { x: 0, y: 0, z: 0 }
    })
    const result = dollySubjectByWheel(state, -100)
    const pos = result!.nextState.lookAt.position

    expect(pos.z).toBeGreaterThan(0)
    expect(pos.z).toBeLessThan(5)
    expect(pos.x).toBeCloseTo(0)
    expect(pos.y).toBeCloseTo(0)
  })

  it('look_at: clamps distance to the shared maximum on scroll-out', () => {
    const state = stateWith({
      mode: 'look_at',
      lookAt: { position: { x: 0, y: 0, z: 5 } },
      target: { x: 0, y: 0, z: 0 }
    })
    const pos = dollySubjectByWheel(state, 100000)!.nextState.lookAt.position

    expect(Math.hypot(pos.x, pos.y, pos.z)).toBeCloseTo(100)
  })

  it('quaternion: moves the position along the camera forward axis', () => {
    const state = stateWith({
      mode: 'quaternion',
      quaternion: {
        position: { x: 0, y: 0, z: 5 },
        quat: { x: 0, y: 0, z: 0, w: 1 }
      }
    })
    const result = dollySubjectByWheel(state, -100)
    const pos = result!.nextState.quaternion.position

    expect(pos.z).toBeCloseTo(4)
    expect(pos.x).toBeCloseTo(0)
    expect(pos.y).toBeCloseTo(0)
  })
})

describe('dollySubjectByWheel - orthographic', () => {
  it('changes zoom rather than position, regardless of mode', () => {
    const state = stateWith({ mode: 'orbit', cameraType: 'orthographic' })
    const zoomedIn = dollySubjectByWheel(state, -100)
    const zoomedOut = dollySubjectByWheel(state, 100)

    expect(zoomedIn!.updates[0].fieldName).toBe('zoom')
    expect(zoomedIn!.nextState.zoom).toBeGreaterThan(state.zoom)
    expect(zoomedOut!.nextState.zoom).toBeLessThan(state.zoom)
    expect(zoomedIn!.nextState.orbit.distance).toBe(state.orbit.distance)
  })

  it('clamps zoom within bounds', () => {
    const state = stateWith({ cameraType: 'orthographic', zoom: 1 })

    expect(dollySubjectByWheel(state, -100000)!.nextState.zoom).toBe(100)
    expect(dollySubjectByWheel(state, 100000)!.nextState.zoom).toBe(0.05)
  })
})

function rotateResultDistance(
  result: ReturnType<typeof dollySubjectByWheel>
): number {
  return result!.nextState.orbit.distance
}
