import * as THREE from 'three'

import type { CameraInfoState } from './types'

const DEG2RAD = Math.PI / 180

export interface SubjectCameraTransform {
  position: THREE.Vector3
  quaternion: THREE.Quaternion
}

function orbitPosition(
  target: THREE.Vector3Like,
  yawDeg: number,
  pitchDeg: number,
  distance: number
): THREE.Vector3 {
  const y = yawDeg * DEG2RAD
  const p = pitchDeg * DEG2RAD
  const cp = Math.cos(p)
  return new THREE.Vector3(
    target.x + distance * cp * Math.sin(y),
    target.y + distance * Math.sin(p),
    target.z + distance * cp * Math.cos(y)
  )
}

function lookAtQuaternion(
  position: THREE.Vector3,
  target: THREE.Vector3Like,
  rollDeg: number
): THREE.Quaternion {
  const targetVec = new THREE.Vector3(target.x, target.y, target.z)
  const m = new THREE.Matrix4().lookAt(
    position,
    targetVec,
    new THREE.Vector3(0, 1, 0)
  )
  const q = new THREE.Quaternion().setFromRotationMatrix(m)
  if (rollDeg !== 0) {
    const rollQ = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      rollDeg * DEG2RAD
    )
    q.multiply(rollQ)
  }
  return q
}

export function normalizeQuaternion(q: THREE.Quaternion): THREE.Quaternion {
  if (q.lengthSq() === 0) q.set(0, 0, 0, 1)
  else q.normalize()
  return q
}

export function computeSubjectTransform(
  state: CameraInfoState
): SubjectCameraTransform {
  if (state.mode === 'quaternion') {
    const p = state.quaternion.position
    const q = state.quaternion.quat
    const quaternion = normalizeQuaternion(
      new THREE.Quaternion(q.x, q.y, q.z, q.w)
    )
    return {
      position: new THREE.Vector3(p.x, p.y, p.z),
      quaternion
    }
  }

  const position =
    state.mode === 'orbit'
      ? orbitPosition(
          state.target,
          state.orbit.yaw,
          state.orbit.pitch,
          state.orbit.distance
        )
      : new THREE.Vector3(
          state.lookAt.position.x,
          state.lookAt.position.y,
          state.lookAt.position.z
        )

  return {
    position,
    quaternion: lookAtQuaternion(position, state.target, state.roll)
  }
}
