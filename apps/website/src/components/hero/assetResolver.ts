import type {
  AzimuthLabel,
  CameraPose,
  DistanceLabel,
  ElevationLabel
} from './cameraVocabulary'
import {
  AZIMUTH_LABELS,
  DISTANCE_LABELS,
  ELEVATION_LABELS,
  azimuthLabel,
  distanceLabel,
  elevationLabel
} from './cameraVocabulary'

export interface AngleAsset {
  azimuth: AzimuthLabel
  elevation: ElevationLabel
  distance: DistanceLabel
  src: string
  width: number
  height: number
}

function angleAsset(
  azimuth: AzimuthLabel,
  elevation: ElevationLabel,
  distance: DistanceLabel
): AngleAsset {
  const slug = [azimuth, elevation, distance]
    .map((label) => label.replaceAll(' ', '-'))
    .join('__')
  return {
    azimuth,
    elevation,
    distance,
    src: `/hero/angles/${slug}.webp`,
    width: 960,
    height: 519
  }
}

export const ANGLE_ASSETS: AngleAsset[] = [
  angleAsset('front view', 'eye-level shot', 'close-up'),
  angleAsset('front view', 'eye-level shot', 'medium shot'),
  angleAsset('front view', 'eye-level shot', 'wide shot'),
  angleAsset('front view', 'high-angle shot', 'medium shot'),
  angleAsset('front view', 'high-angle shot', 'wide shot'),
  angleAsset('right side view', 'eye-level shot', 'close-up'),
  angleAsset('right side view', 'eye-level shot', 'wide shot'),
  angleAsset('back view', 'eye-level shot', 'medium shot'),
  angleAsset('back view', 'eye-level shot', 'close-up'),
  angleAsset('left side view', 'eye-level shot', 'close-up'),
  angleAsset('left side view', 'eye-level shot', 'wide shot'),
  angleAsset('left side view', 'low-angle shot', 'close-up'),
  angleAsset('left side view', 'low-angle shot', 'medium shot'),
  angleAsset('left side view', 'low-angle shot', 'wide shot'),
  angleAsset('left side view', 'high-angle shot', 'close-up'),
  angleAsset('left side view', 'high-angle shot', 'wide shot')
]

function circularIndexDistance(a: number, b: number, size: number): number {
  const d = Math.abs(a - b)
  return Math.min(d, size - d)
}

function circularDegreeDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return Math.min(d, 360 - d)
}

const ELEVATION_VALUES = [-30, 0, 30, 60]
const DISTANCE_VALUES = [1, 4, 8]

/**
 * Nearest-pose snapping: azimuth dominates, then elevation, then distance,
 * scored on label buckets with the raw pose as tiebreak. Never returns
 * undefined — an empty state is impossible by construction.
 */
export function resolveAsset(pose: CameraPose): AngleAsset {
  const target = {
    azimuth: AZIMUTH_LABELS.indexOf(azimuthLabel(pose.azimuth)),
    elevation: ELEVATION_LABELS.indexOf(elevationLabel(pose.elevation)),
    distance: DISTANCE_LABELS.indexOf(distanceLabel(pose.zoom))
  }

  let best = ANGLE_ASSETS[0]
  let bestScore = Number.POSITIVE_INFINITY
  let bestTiebreak = Number.POSITIVE_INFINITY
  for (const asset of ANGLE_ASSETS) {
    const azimuthIndex = AZIMUTH_LABELS.indexOf(asset.azimuth)
    const elevationIndex = ELEVATION_LABELS.indexOf(asset.elevation)
    const distanceIndex = DISTANCE_LABELS.indexOf(asset.distance)
    const score =
      circularIndexDistance(
        azimuthIndex,
        target.azimuth,
        AZIMUTH_LABELS.length
      ) *
        100 +
      Math.abs(elevationIndex - target.elevation) * 10 +
      Math.abs(distanceIndex - target.distance)
    const tiebreak =
      circularDegreeDistance(azimuthIndex * 45, pose.azimuth) +
      Math.abs(ELEVATION_VALUES[elevationIndex] - pose.elevation) +
      Math.abs(DISTANCE_VALUES[distanceIndex] - pose.zoom)
    if (score < bestScore || (score === bestScore && tiebreak < bestTiebreak)) {
      bestScore = score
      bestTiebreak = tiebreak
      best = asset
    }
  }
  return best
}
