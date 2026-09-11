import { clamp } from 'es-toolkit'

import type { Vector3Like } from 'three'

import { DEFAULT_CAMERA_INFO_STATE } from '@/extensions/core/cameraInfo/types'
import type { CameraInfoState } from '@/extensions/core/cameraInfo/types'
import type { OrbitHandleType } from '@/extensions/core/cameraInfo/handles/OrbitHandles'
import {
  pointToDistance,
  pointToPitchAngle,
  pointToYawAngle
} from '@/extensions/core/cameraInfo/handles/orbitDragMath'

import {
  CAMERA_ANGLE_FOV,
  CAMERA_ANGLE_LIMITS,
  MAX_DISPLAY_DISTANCE,
  MAX_SUBJECT_DISTANCE,
  MIN_DISPLAY_DISTANCE,
  MIN_SUBJECT_DISTANCE,
  ORBIT_SPHERE_RADIUS,
  SUBJECT_CENTER
} from './types'
import type { CameraAngleState } from './types'

const DRAG_DEGREES_PER_PIXEL = 0.5
const WHEEL_ZOOM_PER_PIXEL = 0.01
const ZOOM_DECIMALS = 1

export interface CameraAngleTerm {
  key: string
  prompt: string
  preset: number
}

export const HORIZONTAL_TERMS: readonly CameraAngleTerm[] = [
  { key: 'front', prompt: 'front view', preset: 0 },
  { key: 'frontRight', prompt: 'front-right quarter view', preset: 45 },
  { key: 'right', prompt: 'right side view', preset: 90 },
  { key: 'backRight', prompt: 'back-right quarter view', preset: 135 },
  { key: 'back', prompt: 'back view', preset: 180 },
  { key: 'backLeft', prompt: 'back-left quarter view', preset: 225 },
  { key: 'left', prompt: 'left side view', preset: 270 },
  { key: 'frontLeft', prompt: 'front-left quarter view', preset: 315 }
]

export const VERTICAL_TERMS: readonly CameraAngleTerm[] = [
  { key: 'lowAngle', prompt: 'low-angle shot', preset: -20 },
  { key: 'eyeLevel', prompt: 'eye-level shot', preset: 0 },
  { key: 'elevated', prompt: 'elevated shot', preset: 30 },
  { key: 'highAngle', prompt: 'high-angle shot', preset: 55 }
]
const VERTICAL_UPPER_BOUNDS = [-15, 15, 45]

export const DISTANCE_TERMS: readonly CameraAngleTerm[] = [
  { key: 'wide', prompt: 'wide shot', preset: 1 },
  { key: 'medium', prompt: 'medium shot', preset: 5 },
  { key: 'closeUp', prompt: 'close-up', preset: 8 }
]
const DISTANCE_UPPER_BOUNDS = [2, 6]

export function normalizeHorizontal(degrees: number): number {
  return ((degrees % 360) + 360) % 360
}

export function clampState(state: CameraAngleState): CameraAngleState {
  return {
    horizontal: clamp(
      state.horizontal,
      CAMERA_ANGLE_LIMITS.horizontal.min,
      CAMERA_ANGLE_LIMITS.horizontal.max
    ),
    vertical: clamp(
      state.vertical,
      CAMERA_ANGLE_LIMITS.vertical.min,
      CAMERA_ANGLE_LIMITS.vertical.max
    ),
    zoom: clamp(
      state.zoom,
      CAMERA_ANGLE_LIMITS.zoom.min,
      CAMERA_ANGLE_LIMITS.zoom.max
    )
  }
}

export function roundState(state: CameraAngleState): CameraAngleState {
  const zoomScale = 10 ** ZOOM_DECIMALS
  return clampState({
    horizontal: Math.round(state.horizontal),
    vertical: Math.round(state.vertical),
    zoom: Math.round(state.zoom * zoomScale) / zoomScale
  })
}

function bucket(
  value: number,
  upperBounds: readonly number[],
  terms: readonly CameraAngleTerm[]
): CameraAngleTerm {
  const index = upperBounds.findIndex((upper) => value < upper)
  return terms[index === -1 ? terms.length - 1 : index]
}

export function horizontalTerm(degrees: number): CameraAngleTerm {
  const sector =
    Math.floor((normalizeHorizontal(degrees) + 22.5) / 45) %
    HORIZONTAL_TERMS.length
  return HORIZONTAL_TERMS[sector]
}

export function verticalTerm(degrees: number): CameraAngleTerm {
  return bucket(degrees, VERTICAL_UPPER_BOUNDS, VERTICAL_TERMS)
}

export function distanceTerm(zoom: number): CameraAngleTerm {
  return bucket(zoom, DISTANCE_UPPER_BOUNDS, DISTANCE_TERMS)
}

export function describeCameraAngle(state: CameraAngleState): string {
  return [
    horizontalTerm(state.horizontal).prompt,
    verticalTerm(state.vertical).prompt,
    distanceTerm(state.zoom).prompt
  ].join(' ')
}

function zoomToRange(zoom: number, near: number, far: number): number {
  return far - ((far - near) * zoom) / CAMERA_ANGLE_LIMITS.zoom.max
}

function rangeToZoom(distance: number, near: number, far: number): number {
  return ((far - distance) * CAMERA_ANGLE_LIMITS.zoom.max) / (far - near)
}

export function zoomToDistance(zoom: number): number {
  return zoomToRange(zoom, MIN_SUBJECT_DISTANCE, MAX_SUBJECT_DISTANCE)
}

export function distanceToZoom(distance: number): number {
  return rangeToZoom(distance, MIN_SUBJECT_DISTANCE, MAX_SUBJECT_DISTANCE)
}

export function zoomToDisplayDistance(zoom: number): number {
  return zoomToRange(zoom, MIN_DISPLAY_DISTANCE, MAX_DISPLAY_DISTANCE)
}

export function displayDistanceToZoom(distance: number): number {
  return rangeToZoom(distance, MIN_DISPLAY_DISTANCE, MAX_DISPLAY_DISTANCE)
}

function orbitState(
  state: CameraAngleState,
  distance: number
): CameraInfoState {
  return {
    ...DEFAULT_CAMERA_INFO_STATE,
    mode: 'orbit',
    target: { ...SUBJECT_CENTER },
    fov: CAMERA_ANGLE_FOV,
    orbit: { yaw: state.horizontal, pitch: state.vertical, distance }
  }
}

export function toOrbitCameraInfoState(
  state: CameraAngleState
): CameraInfoState {
  return orbitState(state, zoomToDistance(state.zoom))
}

export function toHandleOrbitState(state: CameraAngleState): CameraInfoState {
  return orbitState(state, zoomToDisplayDistance(state.zoom))
}

const OVERVIEW_FIT_MARGIN = 1.2

export function overviewDistance(aspect: number, fovDegrees: number): number {
  const halfFov = (fovDegrees / 2) * (Math.PI / 180)
  const shortSide = Math.min(1, aspect)
  return (
    (ORBIT_SPHERE_RADIUS * OVERVIEW_FIT_MARGIN) /
    (Math.tan(halfFov) * shortSide)
  )
}

export function rotateByDrag(
  state: CameraAngleState,
  dx: number,
  dy: number
): CameraAngleState {
  return clampState({
    ...state,
    horizontal: normalizeHorizontal(
      state.horizontal - dx * DRAG_DEGREES_PER_PIXEL
    ),
    vertical: state.vertical + dy * DRAG_DEGREES_PER_PIXEL
  })
}

export function dollyByWheel(
  state: CameraAngleState,
  deltaY: number
): CameraAngleState {
  return clampState({
    ...state,
    zoom: state.zoom - deltaY * WHEEL_ZOOM_PER_PIXEL
  })
}

export function stateFromHandleDrag(
  type: OrbitHandleType,
  state: CameraAngleState,
  point: Vector3Like
): CameraAngleState {
  if (type === 'yaw') {
    return clampState({
      ...state,
      horizontal: normalizeHorizontal(pointToYawAngle(point, SUBJECT_CENTER))
    })
  }
  if (type === 'pitch') {
    return clampState({
      ...state,
      vertical: pointToPitchAngle(point, SUBJECT_CENTER, state.horizontal)
    })
  }
  return clampState({
    ...state,
    zoom: displayDistanceToZoom(
      pointToDistance(point, SUBJECT_CENTER, state.horizontal, state.vertical)
    )
  })
}
