import { DEFAULT_CAMERA_INFO_STATE } from '@/extensions/core/cameraInfo/types'
import type { CameraInfoState } from '@/extensions/core/cameraInfo/types'

import { lightTarget } from './types'
import type { LightInfoEntry, Vec3 } from './types'

const DEG2RAD = Math.PI / 180
const RAD2DEG = 180 / Math.PI

export interface OrbitAngles {
  yaw: number
  pitch: number
  distance: number
}

export function orbitPosition(
  target: Vec3,
  yawDeg: number,
  pitchDeg: number,
  distance: number
): Vec3 {
  const yaw = yawDeg * DEG2RAD
  const pitch = pitchDeg * DEG2RAD
  const cosPitch = Math.cos(pitch)
  return {
    x: target.x + distance * cosPitch * Math.sin(yaw),
    y: target.y + distance * Math.sin(pitch),
    z: target.z + distance * cosPitch * Math.cos(yaw)
  }
}

export function orbitAnglesFor(position: Vec3, target: Vec3): OrbitAngles {
  const dx = position.x - target.x
  const dy = position.y - target.y
  const dz = position.z - target.z
  const horizontal = Math.hypot(dx, dz)
  const distance = Math.max(Math.hypot(dx, dy, dz), 1e-6)
  return {
    yaw: Math.atan2(dx, dz) * RAD2DEG,
    pitch: Math.atan2(dy, horizontal) * RAD2DEG,
    distance
  }
}

export function orbitHandleState(
  light: LightInfoEntry | null
): CameraInfoState {
  if (light?.type !== 'directional') {
    return { ...DEFAULT_CAMERA_INFO_STATE, mode: 'look_at' }
  }
  const target = lightTarget(light)
  return {
    ...DEFAULT_CAMERA_INFO_STATE,
    mode: 'orbit',
    target,
    orbit: orbitAnglesFor(light.position, target)
  }
}
