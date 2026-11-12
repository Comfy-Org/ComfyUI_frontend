import type { QuaternionLike, Vector3Like } from 'three'

export type CameraInfoMode = 'orbit' | 'look_at' | 'quaternion'

export type CameraInfoCameraType = 'perspective' | 'orthographic'

export type CameraInfoFieldName =
  | 'mode.yaw'
  | 'mode.pitch'
  | 'mode.distance'
  | 'target_x'
  | 'target_y'
  | 'target_z'
  | 'mode.position_x'
  | 'mode.position_y'
  | 'mode.position_z'
  | 'mode.quat_x'
  | 'mode.quat_y'
  | 'mode.quat_z'
  | 'mode.quat_w'
  | 'roll'
  | 'fov'
  | 'zoom'

interface OrbitInputs {
  yaw: number
  pitch: number
  distance: number
}

interface LookAtInputs {
  position: Vector3Like
}

interface QuaternionInputs {
  position: Vector3Like
  quat: QuaternionLike
}

export interface CameraInfoState {
  mode: CameraInfoMode
  target: Vector3Like
  roll: number
  fov: number
  zoom: number
  cameraType: CameraInfoCameraType
  orbit: OrbitInputs
  lookAt: LookAtInputs
  quaternion: QuaternionInputs
}

export const DEFAULT_CAMERA_INFO_STATE: CameraInfoState = {
  mode: 'orbit',
  target: { x: 0, y: 0, z: 0 },
  roll: 0,
  fov: 35,
  zoom: 1,
  cameraType: 'perspective',
  orbit: { yaw: 35, pitch: 30, distance: 4 },
  lookAt: { position: { x: 4, y: 4, z: 4 } },
  quaternion: {
    position: { x: 4, y: 4, z: 4 },
    quat: { x: 0, y: 0, z: 0, w: 1 }
  }
}
