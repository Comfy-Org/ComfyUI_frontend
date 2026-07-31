import type {
  AzimuthLabel,
  CameraPose,
  DistanceLabel,
  ElevationLabel
} from './cameraVocabulary'
import {
  DISTANCE_LABELS,
  ELEVATION_LABELS,
  azimuthLabel,
  distanceLabel,
  elevationLabel
} from './cameraVocabulary'

export interface AngleAsset {
  /** Turntable azimuth this frame was rendered at, in degrees. */
  azimuthDegrees: number
  azimuth: AzimuthLabel
  elevation: ElevationLabel
  distance: DistanceLabel
  src: string
  width: number
  height: number
}

/** The shipped set is a uniform 360° turntable at eye level, medium shot.
 * Elevation and distance variants (top/bottom views, close-ups, wide shots)
 * land later and slot into the same scoring. */
const RING_STEP_DEGREES = 22.5

function ringAsset(azimuthDegrees: number): AngleAsset {
  const whole = String(Math.floor(azimuthDegrees)).padStart(3, '0')
  const slug = `az${whole}-${azimuthDegrees % 1 ? '5' : '0'}`
  return {
    azimuthDegrees,
    azimuth: azimuthLabel(azimuthDegrees),
    elevation: 'eye-level shot',
    distance: 'medium shot',
    src: `/hero/angles/${slug}__eye-level-shot__medium-shot.webp`,
    width: 1280,
    height: 960
  }
}

export const ANGLE_ASSETS: AngleAsset[] = Array.from(
  { length: 360 / RING_STEP_DEGREES },
  (_, index) => ringAsset(index * RING_STEP_DEGREES)
)

function circularDegreeDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return Math.min(d, 360 - d)
}

/**
 * Nearest-pose snapping: azimuth dominates, then elevation, then distance.
 * Never returns undefined — an empty state is impossible by construction.
 */
export function resolveAsset(pose: CameraPose): AngleAsset {
  const elevationIndex = ELEVATION_LABELS.indexOf(
    elevationLabel(pose.elevation)
  )
  const distanceIndex = DISTANCE_LABELS.indexOf(distanceLabel(pose.zoom))

  let best = ANGLE_ASSETS[0]
  let bestScore = Number.POSITIVE_INFINITY
  for (const asset of ANGLE_ASSETS) {
    const score =
      circularDegreeDistance(asset.azimuthDegrees, pose.azimuth) * 100 +
      Math.abs(ELEVATION_LABELS.indexOf(asset.elevation) - elevationIndex) *
        10 +
      Math.abs(DISTANCE_LABELS.indexOf(asset.distance) - distanceIndex)
    if (score < bestScore) {
      bestScore = score
      best = asset
    }
  }
  return best
}
