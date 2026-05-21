/**
 * Wire format for Load3DCamera.CameraInfo coming from the backend
 * (Python `Load3DCamera.CameraInfo` TypedDict). Vectors arrive as plain
 * {x, y, z} objects after JSON serialization.
 */
import * as THREE from 'three'

import type { CameraState, CameraType } from './interfaces'

export interface CameraInfoSerialized {
  position: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
  zoom: number
  cameraType: CameraType
}

export function toCameraState(info: CameraInfoSerialized): CameraState {
  return {
    position: new THREE.Vector3(
      info.position.x,
      info.position.y,
      info.position.z
    ),
    target: new THREE.Vector3(info.target.x, info.target.y, info.target.z),
    zoom: info.zoom,
    cameraType: info.cameraType
  }
}
