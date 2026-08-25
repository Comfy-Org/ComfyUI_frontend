import { clamp } from 'es-toolkit'
import * as THREE from 'three'

import { normalizeQuaternion } from './cameraTransform'
import {
  MAX_DISTANCE,
  MAX_PITCH,
  MIN_DISTANCE,
  MIN_PITCH
} from './handles/orbitDragMath'
import type { CameraInfoFieldName, CameraInfoState } from './types'

const DEG2RAD = Math.PI / 180
const RAD2DEG = 180 / Math.PI
const ELEVATION_LIMIT = MAX_PITCH * DEG2RAD
const DOLLY_EXP_SENSITIVITY = 0.0015
const FREE_DOLLY_UNIT = 0.01
const MIN_ZOOM = 0.05
const MAX_ZOOM = 100

interface FieldUpdate {
  fieldName: CameraInfoFieldName
  value: number
}

export interface LookThroughResult {
  nextState: CameraInfoState
  updates: FieldUpdate[]
}

function directionToSpherical(dir: THREE.Vector3): {
  azimuth: number
  elevation: number
} {
  return {
    azimuth: Math.atan2(dir.x, dir.z),
    elevation: Math.asin(clamp(dir.y, -1, 1))
  }
}

function sphericalToDirection(
  azimuth: number,
  elevation: number
): THREE.Vector3 {
  const ce = Math.cos(elevation)
  return new THREE.Vector3(
    ce * Math.sin(azimuth),
    Math.sin(elevation),
    ce * Math.cos(azimuth)
  )
}

function rotateOrbit(
  state: CameraInfoState,
  yawDelta: number,
  pitchDelta: number
): LookThroughResult {
  const yaw = state.orbit.yaw + yawDelta * RAD2DEG
  const pitch = clamp(
    state.orbit.pitch + pitchDelta * RAD2DEG,
    MIN_PITCH,
    MAX_PITCH
  )
  return {
    nextState: { ...state, orbit: { ...state.orbit, yaw, pitch } },
    updates: [
      { fieldName: 'mode.yaw', value: yaw },
      { fieldName: 'mode.pitch', value: pitch }
    ]
  }
}

function rotateLookAt(
  state: CameraInfoState,
  yawDelta: number,
  pitchDelta: number
): LookThroughResult | null {
  const position = new THREE.Vector3(
    state.lookAt.position.x,
    state.lookAt.position.y,
    state.lookAt.position.z
  )
  const target = new THREE.Vector3(
    state.target.x,
    state.target.y,
    state.target.z
  )
  const offset = target.clone().sub(position)
  const distance = offset.length()
  if (distance < 1e-6) return null

  const { azimuth, elevation } = directionToSpherical(
    offset.clone().normalize()
  )
  const nextAzimuth = azimuth + yawDelta
  const nextElevation = clamp(
    elevation + pitchDelta,
    -ELEVATION_LIMIT,
    ELEVATION_LIMIT
  )
  const dir = sphericalToDirection(nextAzimuth, nextElevation)
  const nextTarget: THREE.Vector3Like = {
    x: position.x + dir.x * distance,
    y: position.y + dir.y * distance,
    z: position.z + dir.z * distance
  }
  return {
    nextState: { ...state, target: nextTarget },
    updates: [
      { fieldName: 'target_x', value: nextTarget.x },
      { fieldName: 'target_y', value: nextTarget.y },
      { fieldName: 'target_z', value: nextTarget.z }
    ]
  }
}

function rotateQuaternion(
  state: CameraInfoState,
  yawDelta: number,
  pitchDelta: number
): LookThroughResult {
  const q = normalizeQuaternion(
    new THREE.Quaternion(
      state.quaternion.quat.x,
      state.quaternion.quat.y,
      state.quaternion.quat.z,
      state.quaternion.quat.w
    )
  )

  const yawQ = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    yawDelta
  )
  const pitchQ = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    pitchDelta
  )
  q.premultiply(yawQ).multiply(pitchQ).normalize()

  const quat = { x: q.x, y: q.y, z: q.z, w: q.w }
  return {
    nextState: { ...state, quaternion: { ...state.quaternion, quat } },
    updates: [
      { fieldName: 'mode.quat_x', value: quat.x },
      { fieldName: 'mode.quat_y', value: quat.y },
      { fieldName: 'mode.quat_z', value: quat.z },
      { fieldName: 'mode.quat_w', value: quat.w }
    ]
  }
}

export function rotateSubjectByDrag(
  state: CameraInfoState,
  yawDelta: number,
  pitchDelta: number
): LookThroughResult | null {
  switch (state.mode) {
    case 'orbit':
      return rotateOrbit(state, yawDelta, pitchDelta)
    case 'look_at':
      return rotateLookAt(state, yawDelta, pitchDelta)
    case 'quaternion':
      return rotateQuaternion(state, yawDelta, pitchDelta)
  }
}

function dollyOrbit(state: CameraInfoState, deltaY: number): LookThroughResult {
  const factor = Math.exp(deltaY * DOLLY_EXP_SENSITIVITY)
  const distance = clamp(
    state.orbit.distance * factor,
    MIN_DISTANCE,
    MAX_DISTANCE
  )
  return {
    nextState: { ...state, orbit: { ...state.orbit, distance } },
    updates: [{ fieldName: 'mode.distance', value: distance }]
  }
}

function dollyLookAt(
  state: CameraInfoState,
  deltaY: number
): LookThroughResult | null {
  const position = new THREE.Vector3(
    state.lookAt.position.x,
    state.lookAt.position.y,
    state.lookAt.position.z
  )
  const target = new THREE.Vector3(
    state.target.x,
    state.target.y,
    state.target.z
  )
  const offset = position.clone().sub(target)
  const distance = offset.length()
  if (distance < 1e-6) return null

  const factor = Math.exp(deltaY * DOLLY_EXP_SENSITIVITY)
  const nextDistance = clamp(distance * factor, MIN_DISTANCE, MAX_DISTANCE)
  const next = target
    .clone()
    .add(offset.multiplyScalar(nextDistance / distance))
  const nextPosition: THREE.Vector3Like = { x: next.x, y: next.y, z: next.z }
  return {
    nextState: { ...state, lookAt: { position: nextPosition } },
    updates: [
      { fieldName: 'mode.position_x', value: nextPosition.x },
      { fieldName: 'mode.position_y', value: nextPosition.y },
      { fieldName: 'mode.position_z', value: nextPosition.z }
    ]
  }
}

function dollyQuaternion(
  state: CameraInfoState,
  deltaY: number
): LookThroughResult {
  const q = normalizeQuaternion(
    new THREE.Quaternion(
      state.quaternion.quat.x,
      state.quaternion.quat.y,
      state.quaternion.quat.z,
      state.quaternion.quat.w
    )
  )

  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(q)
  const step = -deltaY * FREE_DOLLY_UNIT
  const p = state.quaternion.position
  const nextPosition: THREE.Vector3Like = {
    x: p.x + forward.x * step,
    y: p.y + forward.y * step,
    z: p.z + forward.z * step
  }
  return {
    nextState: {
      ...state,
      quaternion: { ...state.quaternion, position: nextPosition }
    },
    updates: [
      { fieldName: 'mode.position_x', value: nextPosition.x },
      { fieldName: 'mode.position_y', value: nextPosition.y },
      { fieldName: 'mode.position_z', value: nextPosition.z }
    ]
  }
}

function dollyZoom(state: CameraInfoState, deltaY: number): LookThroughResult {
  const factor = Math.exp(deltaY * DOLLY_EXP_SENSITIVITY)
  const zoom = clamp(state.zoom / factor, MIN_ZOOM, MAX_ZOOM)
  return {
    nextState: { ...state, zoom },
    updates: [{ fieldName: 'zoom', value: zoom }]
  }
}

export function dollySubjectByWheel(
  state: CameraInfoState,
  deltaY: number
): LookThroughResult | null {
  if (state.cameraType === 'orthographic') return dollyZoom(state, deltaY)
  switch (state.mode) {
    case 'orbit':
      return dollyOrbit(state, deltaY)
    case 'look_at':
      return dollyLookAt(state, deltaY)
    case 'quaternion':
      return dollyQuaternion(state, deltaY)
  }
}
