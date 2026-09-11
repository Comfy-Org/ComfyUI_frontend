import { describe, expect, it } from 'vitest'

import {
  clampState,
  describeCameraAngle,
  displayDistanceToZoom,
  distanceTerm,
  distanceToZoom,
  dollyByWheel,
  horizontalTerm,
  normalizeHorizontal,
  overviewDistance,
  rotateByDrag,
  roundState,
  stateFromHandleDrag,
  toHandleOrbitState,
  toOrbitCameraInfoState,
  verticalTerm,
  zoomToDisplayDistance,
  zoomToDistance
} from './cameraAngleMath'
import {
  CAMERA_ANGLE_FOV,
  MAX_DISPLAY_DISTANCE,
  MAX_SUBJECT_DISTANCE,
  MIN_DISPLAY_DISTANCE,
  MIN_SUBJECT_DISTANCE,
  ORBIT_SPHERE_RADIUS,
  SUBJECT_CENTER
} from './types'
import type { CameraAngleState } from './types'

const FRONT: CameraAngleState = { horizontal: 0, vertical: 0, zoom: 5 }

describe('term buckets', () => {
  it.each([
    [0, 'front'],
    [22, 'front'],
    [23, 'frontRight'],
    [90, 'right'],
    [180, 'back'],
    [270, 'left'],
    [338, 'front'],
    [-45, 'frontLeft']
  ])('maps %d° to the %s sector', (angle, key) => {
    expect(horizontalTerm(angle).key).toBe(key)
  })

  it.each([
    [-30, 'lowAngle'],
    [-15, 'eyeLevel'],
    [14, 'eyeLevel'],
    [15, 'elevated'],
    [45, 'highAngle']
  ])('maps %d° elevation to %s', (angle, key) => {
    expect(verticalTerm(angle).key).toBe(key)
  })

  it.each([
    [0, 'wide'],
    [1.9, 'wide'],
    [2, 'medium'],
    [6, 'closeUp'],
    [10, 'closeUp']
  ])('maps zoom %d to %s', (zoom, key) => {
    expect(distanceTerm(zoom).key).toBe(key)
  })

  it('joins the three prompt phrases in order', () => {
    expect(
      describeCameraAngle({ horizontal: 135, vertical: 50, zoom: 1 })
    ).toBe('back-right quarter view high-angle shot wide shot')
  })
})

describe('state normalisation', () => {
  it('wraps horizontal degrees into [0, 360)', () => {
    expect(normalizeHorizontal(370)).toBe(10)
    expect(normalizeHorizontal(-10)).toBe(350)
    expect(normalizeHorizontal(360)).toBe(0)
  })

  it('clamps every field to its allowed range', () => {
    expect(clampState({ horizontal: 400, vertical: -90, zoom: 99 })).toEqual({
      horizontal: 360,
      vertical: -30,
      zoom: 10
    })
  })

  it('rounds angles to whole degrees and zoom to a tenth for the widgets', () => {
    expect(
      roundState({ horizontal: 328.6, vertical: 35.4, zoom: 3.49999 })
    ).toEqual({
      horizontal: 329,
      vertical: 35,
      zoom: 3.5
    })
  })

  it('maps zoom to distance and back', () => {
    expect(zoomToDistance(0)).toBe(MAX_SUBJECT_DISTANCE)
    expect(zoomToDistance(10)).toBe(MIN_SUBJECT_DISTANCE)
    expect(distanceToZoom(zoomToDistance(3.5))).toBeCloseTo(3.5)
  })

  it('keeps the whole orbit sphere in view for the overview camera', () => {
    const halfFov = Math.tan((35 / 2) * (Math.PI / 180))
    const wide = overviewDistance(16 / 9, 35)
    const tall = overviewDistance(0.5, 35)
    expect(wide * halfFov).toBeGreaterThan(ORBIT_SPHERE_RADIUS)
    expect(tall * halfFov * 0.5).toBeGreaterThan(ORBIT_SPHERE_RADIUS)
    expect(tall).toBeGreaterThan(wide)
  })

  it('maps zoom onto the compressed gizmo distance and back', () => {
    expect(zoomToDisplayDistance(0)).toBe(MAX_DISPLAY_DISTANCE)
    expect(zoomToDisplayDistance(10)).toBe(MIN_DISPLAY_DISTANCE)
    expect(displayDistanceToZoom(zoomToDisplayDistance(7))).toBeCloseTo(7)
    expect(
      toHandleOrbitState({ horizontal: 0, vertical: 0, zoom: 0 }).orbit.distance
    ).toBe(MAX_DISPLAY_DISTANCE)
  })

  it('builds an orbit CameraInfoState around the subject centre', () => {
    const state = toOrbitCameraInfoState({
      horizontal: 30,
      vertical: 10,
      zoom: 0
    })
    expect(state.mode).toBe('orbit')
    expect(state.target).toEqual(SUBJECT_CENTER)
    expect(state.fov).toBe(CAMERA_ANGLE_FOV)
    expect(state.orbit).toEqual({
      yaw: 30,
      pitch: 10,
      distance: MAX_SUBJECT_DISTANCE
    })
  })
})

describe('object-view input', () => {
  it('dragging right turns the subject to the right by lowering the azimuth', () => {
    const next = rotateByDrag(FRONT, 40, 0)
    expect(next.horizontal).toBe(340)
    expect(next.vertical).toBe(0)
  })

  it('dragging down raises the camera and clamps at the elevation limit', () => {
    expect(rotateByDrag(FRONT, 0, 40).vertical).toBe(20)
    expect(rotateByDrag(FRONT, 0, 400).vertical).toBe(60)
  })

  it('scrolling up zooms in and clamps to the zoom range', () => {
    expect(dollyByWheel(FRONT, -100).zoom).toBeCloseTo(6)
    expect(dollyByWheel(FRONT, 2000).zoom).toBe(0)
  })
})

describe('handle drag', () => {
  it('reads the azimuth from a point on the yaw ring', () => {
    const next = stateFromHandleDrag('yaw', FRONT, {
      x: -1,
      y: SUBJECT_CENTER.y,
      z: 0
    })
    expect(next.horizontal).toBeCloseTo(270)
  })

  it('reads the elevation from a point on the pitch arc and clamps it', () => {
    const above = stateFromHandleDrag('pitch', FRONT, {
      x: 0,
      y: SUBJECT_CENTER.y + 1,
      z: 1
    })
    expect(above.vertical).toBeCloseTo(45)

    const tooHigh = stateFromHandleDrag('pitch', FRONT, {
      x: 0,
      y: SUBJECT_CENTER.y + 10,
      z: 0.1
    })
    expect(tooHigh.vertical).toBe(60)
  })

  it('reads the zoom from the distance handle along the view axis', () => {
    const next = stateFromHandleDrag('distance', FRONT, {
      x: 0,
      y: SUBJECT_CENTER.y,
      z: MIN_DISPLAY_DISTANCE
    })
    expect(next.zoom).toBeCloseTo(10)
  })
})
