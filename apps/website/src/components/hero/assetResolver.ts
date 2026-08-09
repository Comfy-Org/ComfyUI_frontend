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

interface RingSpec {
  elevation: ElevationLabel
  distance: DistanceLabel
  stepDegrees: number
  width: number
  height: number
}

/** Shipped turntable rings: 16-frame eye-level orbits and 10-frame elevated
 * (30°) orbits, one per distance. Further elevation bands (top/bottom views)
 * are just more files plus an entry here. */
const RINGS: RingSpec[] = [
  ...DISTANCE_LABELS.map((distance) => ({
    elevation: 'eye-level shot' as const,
    distance,
    stepDegrees: 22.5,
    width: 1280,
    height: 960
  })),
  ...DISTANCE_LABELS.map((distance) => ({
    elevation: 'elevated shot' as const,
    distance,
    stepDegrees: 36,
    width: 1112,
    height: 834
  }))
]

const slugify = (label: string) => label.replaceAll(' ', '-')

function ringAssets(ring: RingSpec): AngleAsset[] {
  return Array.from({ length: 360 / ring.stepDegrees }, (_, index) => {
    const azimuthDegrees = index * ring.stepDegrees
    const whole = String(Math.floor(azimuthDegrees)).padStart(3, '0')
    const slug = `az${whole}-${azimuthDegrees % 1 ? '5' : '0'}`
    return {
      azimuthDegrees,
      azimuth: azimuthLabel(azimuthDegrees),
      elevation: ring.elevation,
      distance: ring.distance,
      src: `/hero/angles/${slug}__${slugify(ring.elevation)}__${slugify(ring.distance)}.webp`,
      width: ring.width,
      height: ring.height
    }
  })
}

export const ANGLE_ASSETS: AngleAsset[] = RINGS.flatMap(ringAssets)

function circularDegreeDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return Math.min(d, 360 - d)
}

/**
 * Nearest-pose snapping: the pose's elevation band dominates, then its
 * distance band, then nearest azimuth — so scrubbing azimuth never hops
 * between rings, and a band with no shipped ring degrades to the nearest
 * one. Never returns undefined — an empty state is impossible by
 * construction.
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
      Math.abs(ELEVATION_LABELS.indexOf(asset.elevation) - elevationIndex) *
        100_000 +
      Math.abs(DISTANCE_LABELS.indexOf(asset.distance) - distanceIndex) *
        1_000 +
      circularDegreeDistance(asset.azimuthDegrees, pose.azimuth)
    if (score < bestScore) {
      bestScore = score
      best = asset
    }
  }
  return best
}
