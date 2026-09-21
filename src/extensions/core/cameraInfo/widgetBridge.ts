import { DEFAULT_CAMERA_INFO_STATE } from './types'
import type {
  CameraInfoCameraType,
  CameraInfoMode,
  CameraInfoState
} from './types'

interface WidgetLike {
  name: string
  value: unknown
}

export interface NodeWithWidgets {
  widgets?: WidgetLike[]
}

const VALID_MODES: readonly CameraInfoMode[] = [
  'orbit',
  'look_at',
  'quaternion'
]
const VALID_CAMERA_TYPES: readonly CameraInfoCameraType[] = [
  'perspective',
  'orthographic'
]

function widgetByName(
  node: NodeWithWidgets,
  name: string
): WidgetLike | undefined {
  return node.widgets?.find((w) => w.name === name)
}

function num(node: NodeWithWidgets, name: string, fallback: number): number {
  const v = widgetByName(node, name)?.value
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function pickMode(node: NodeWithWidgets): CameraInfoMode {
  const v = widgetByName(node, 'mode')?.value
  return typeof v === 'string' && (VALID_MODES as readonly string[]).includes(v)
    ? (v as CameraInfoMode)
    : DEFAULT_CAMERA_INFO_STATE.mode
}

function pickCameraType(node: NodeWithWidgets): CameraInfoCameraType {
  const v = widgetByName(node, 'camera_type')?.value
  return typeof v === 'string' &&
    (VALID_CAMERA_TYPES as readonly string[]).includes(v)
    ? (v as CameraInfoCameraType)
    : DEFAULT_CAMERA_INFO_STATE.cameraType
}

export function readStateFromWidgets(node: NodeWithWidgets): CameraInfoState {
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

export function writeWidgetValue(
  node: NodeWithWidgets,
  name: string,
  value: number | string
): void {
  const widget = widgetByName(node, name)
  if (!widget || widget.value === value) return
  widget.value = value
}
