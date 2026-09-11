import type { Vector3Like } from 'three'

export interface CameraAngleState {
  horizontal: number
  vertical: number
  zoom: number
}

export type CameraAngleField = keyof CameraAngleState

export type CameraAngleViewMode = 'camera' | 'object'

export const CAMERA_ANGLE_VIEW_MODES: readonly CameraAngleViewMode[] = [
  'camera',
  'object'
]

export const CAMERA_ANGLE_WIDGET_NAMES: Record<CameraAngleField, string> = {
  horizontal: 'horizontal_angle',
  vertical: 'vertical_angle',
  zoom: 'zoom'
}

export const CAMERA_ANGLE_VIEW_WIDGET_NAME = 'view'

export const CAMERA_ANGLE_LIMITS = {
  horizontal: { min: 0, max: 360 },
  vertical: { min: -30, max: 60 },
  zoom: { min: 0, max: 10 }
} as const

export const DEFAULT_CAMERA_ANGLE_STATE: CameraAngleState = {
  horizontal: 0,
  vertical: 0,
  zoom: 5
}

export const SUBJECT_CENTER: Vector3Like = { x: 0, y: 0.5, z: 0 }
export const SUBJECT_HEIGHT = 1
export const CAMERA_ANGLE_FOV = 35
export const MIN_SUBJECT_DISTANCE = 3.2
export const MAX_SUBJECT_DISTANCE = 6

export const ORBIT_SPHERE_RADIUS = 1.5
export const MIN_DISPLAY_DISTANCE = 0.8
export const MAX_DISPLAY_DISTANCE = 1.1
export const YAW_RING_LATITUDE = -40

export interface SubjectFaceLabels {
  back: string
  left: string
  right: string
  top: string
  bottom: string
}

export const DEFAULT_SUBJECT_FACE_LABELS: SubjectFaceLabels = {
  back: 'BACK',
  left: 'LEFT',
  right: 'RIGHT',
  top: 'TOP',
  bottom: 'BOTTOM'
}
