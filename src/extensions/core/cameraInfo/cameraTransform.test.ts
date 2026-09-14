import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { computeSubjectTransform } from './cameraTransform'
import { DEFAULT_CAMERA_INFO_STATE } from './types'
import type { CameraInfoState } from './types'

function withMode(
  mode: CameraInfoState['mode'],
  overrides: Partial<CameraInfoState> = {}
): CameraInfoState {
  return { ...DEFAULT_CAMERA_INFO_STATE, mode, ...overrides }
}

describe('computeSubjectTransform', () => {
  describe('orbit mode', () => {
    it('positions the camera at target + distance along yaw/pitch', () => {
      const state = withMode('orbit', {
        target: { x: 0, y: 0, z: 0 },
        orbit: { yaw: 0, pitch: 0, distance: 5 }
      })

      const { position } = computeSubjectTransform(state)

      expect(position.x).toBeCloseTo(0)
      expect(position.y).toBeCloseTo(0)
      expect(position.z).toBeCloseTo(5)
    })

    it('honors yaw=90deg (camera goes to +X)', () => {
      const state = withMode('orbit', {
        target: { x: 0, y: 0, z: 0 },
        orbit: { yaw: 90, pitch: 0, distance: 5 }
      })

      const { position } = computeSubjectTransform(state)

      expect(position.x).toBeCloseTo(5)
      expect(position.y).toBeCloseTo(0)
      expect(position.z).toBeCloseTo(0)
    })

    it('honors pitch=90deg (camera goes straight up)', () => {
      const state = withMode('orbit', {
        target: { x: 0, y: 0, z: 0 },
        orbit: { yaw: 0, pitch: 90, distance: 5 }
      })

      const { position } = computeSubjectTransform(state)

      expect(position.x).toBeCloseTo(0)
      expect(position.y).toBeCloseTo(5)
      expect(position.z).toBeCloseTo(0, 5)
    })

    it('offsets the orbit by target', () => {
      const state = withMode('orbit', {
        target: { x: 10, y: 20, z: 30 },
        orbit: { yaw: 0, pitch: 0, distance: 5 }
      })

      const { position } = computeSubjectTransform(state)

      expect(position.x).toBeCloseTo(10)
      expect(position.y).toBeCloseTo(20)
      expect(position.z).toBeCloseTo(35)
    })
  })

  describe('look_at mode', () => {
    it('uses explicit position', () => {
      const state = withMode('look_at', {
        lookAt: { position: { x: 1, y: 2, z: 3 } }
      })

      const { position } = computeSubjectTransform(state)

      expect(position.toArray()).toEqual([1, 2, 3])
    })

    it('orients the camera so its forward axis points at the target', () => {
      const state = withMode('look_at', {
        lookAt: { position: { x: 4, y: 3, z: 5 } },
        target: { x: -1, y: 0, z: 2 }
      })

      const { position, quaternion } = computeSubjectTransform(state)
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion)
      const toTarget = new THREE.Vector3(-1, 0, 2).sub(position).normalize()

      expect(forward.angleTo(toTarget)).toBeCloseTo(0)
    })
  })

  describe('quaternion mode', () => {
    it('uses explicit position and quaternion (target ignored)', () => {
      const state = withMode('quaternion', {
        target: { x: 999, y: 999, z: 999 },
        quaternion: {
          position: { x: 7, y: 8, z: 9 },
          quat: { x: 0, y: 0, z: 0, w: 1 }
        }
      })

      const { position, quaternion } = computeSubjectTransform(state)

      expect(position.toArray()).toEqual([7, 8, 9])
      expect(quaternion.x).toBeCloseTo(0)
      expect(quaternion.y).toBeCloseTo(0)
      expect(quaternion.z).toBeCloseTo(0)
      expect(quaternion.w).toBeCloseTo(1)
    })

    it('normalizes a non-unit quaternion', () => {
      const state = withMode('quaternion', {
        quaternion: {
          position: { x: 0, y: 0, z: 0 },
          quat: { x: 2, y: 0, z: 0, w: 0 }
        }
      })

      const { quaternion } = computeSubjectTransform(state)

      expect(quaternion.length()).toBeCloseTo(1)
    })

    it('falls back to identity when given a zero quaternion', () => {
      const state = withMode('quaternion', {
        quaternion: {
          position: { x: 0, y: 0, z: 0 },
          quat: { x: 0, y: 0, z: 0, w: 0 }
        }
      })

      const { quaternion } = computeSubjectTransform(state)

      expect(quaternion.x).toBe(0)
      expect(quaternion.y).toBe(0)
      expect(quaternion.z).toBe(0)
      expect(quaternion.w).toBe(1)
    })
  })

  describe('roll', () => {
    it('rotates around the view axis without moving the camera position', () => {
      const base = withMode('look_at', {
        target: { x: 0, y: 0, z: 0 },
        lookAt: { position: { x: 0, y: 0, z: 5 } },
        roll: 0
      })
      const rolled = { ...base, roll: 45 }

      const a = computeSubjectTransform(base)
      const b = computeSubjectTransform(rolled)

      expect(a.position.toArray()).toEqual(b.position.toArray())

      const forward = new THREE.Vector3(0, 0, -1)
      expect(
        forward
          .clone()
          .applyQuaternion(a.quaternion)
          .angleTo(forward.clone().applyQuaternion(b.quaternion))
      ).toBeCloseTo(0)

      const up = new THREE.Vector3(0, 1, 0)
      expect(
        up
          .clone()
          .applyQuaternion(a.quaternion)
          .angleTo(up.clone().applyQuaternion(b.quaternion))
      ).toBeCloseTo(Math.PI / 4)
    })
  })
})
