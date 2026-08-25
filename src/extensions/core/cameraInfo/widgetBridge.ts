import {
  nodeWidgetValue,
  setNodeWidgetValue
} from '@/composables/node/widgetStoreSync'
import type { WidgetNode } from '@/composables/node/widgetStoreSync'

import { DEFAULT_CAMERA_INFO_STATE } from './types'
import type {
  CameraInfoCameraType,
  CameraInfoMode,
  CameraInfoState
} from './types'

const VALID_MODES: readonly CameraInfoMode[] = [
  'orbit',
  'look_at',
  'quaternion'
]
const VALID_CAMERA_TYPES: readonly CameraInfoCameraType[] = [
  'perspective',
  'orthographic'
]

function num(node: WidgetNode, name: string, fallback: number): number {
  const v = nodeWidgetValue(node, name)
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function pickMode(node: WidgetNode): CameraInfoMode {
  const v = nodeWidgetValue(node, 'mode')
  return typeof v === 'string' && (VALID_MODES as readonly string[]).includes(v)
    ? (v as CameraInfoMode)
    : DEFAULT_CAMERA_INFO_STATE.mode
}

function pickCameraType(node: WidgetNode): CameraInfoCameraType {
  const v = nodeWidgetValue(node, 'camera_type')
  return typeof v === 'string' &&
    (VALID_CAMERA_TYPES as readonly string[]).includes(v)
    ? (v as CameraInfoCameraType)
    : DEFAULT_CAMERA_INFO_STATE.cameraType
}

export function readCameraInfoState(node: WidgetNode): CameraInfoState {
  const d = DEFAULT_CAMERA_INFO_STATE
  return {
    mode: pickMode(node),
    target: {
      x: num(node, 'target_x', d.target.x),
      y: num(node, 'target_y', d.target.y),
      z: num(node, 'target_z', d.target.z)
    },
    roll: num(node, 'roll', d.roll),
    fov: num(node, 'fov', d.fov),
    zoom: num(node, 'zoom', d.zoom),
    cameraType: pickCameraType(node),
    orbit: {
      yaw: num(node, 'mode.yaw', d.orbit.yaw),
      pitch: num(node, 'mode.pitch', d.orbit.pitch),
      distance: num(node, 'mode.distance', d.orbit.distance)
    },
    lookAt: {
      position: {
        x: num(node, 'mode.position_x', d.lookAt.position.x),
        y: num(node, 'mode.position_y', d.lookAt.position.y),
        z: num(node, 'mode.position_z', d.lookAt.position.z)
      }
    },
    quaternion: {
      position: {
        x: num(node, 'mode.position_x', d.quaternion.position.x),
        y: num(node, 'mode.position_y', d.quaternion.position.y),
        z: num(node, 'mode.position_z', d.quaternion.position.z)
      },
      quat: {
        x: num(node, 'mode.quat_x', d.quaternion.quat.x),
        y: num(node, 'mode.quat_y', d.quaternion.quat.y),
        z: num(node, 'mode.quat_z', d.quaternion.quat.z),
        w: num(node, 'mode.quat_w', d.quaternion.quat.w)
      }
    }
  }
}

export function writeCameraInfoValue(
  node: WidgetNode,
  name: string,
  value: number | string
): void {
  setNodeWidgetValue(node, name, value)
}
