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
  azimuths: readonly number[]
  width: number
  height: number
}

const EYE_LEVEL_AZIMUTHS = Array.from({ length: 16 }, (_, i) => i * 22.5)

/** Shipped turntable rings: three uniform 16-frame eye-level orbits plus
 * three 17-frame elevated (30°) orbits, one per distance. The elevated
 * orbits come from eased, deduplicated video extractions, so their frames
 * sit at measured rather than uniform azimuths; each ring is phased so
 * azimuth 0 is the input image's viewpoint and all rings orbit the same
 * direction. Further elevation bands are more files plus an entry here. */
const RINGS: RingSpec[] = [
  ...DISTANCE_LABELS.map((distance) => ({
    elevation: 'eye-level shot' as const,
    distance,
    azimuths: EYE_LEVEL_AZIMUTHS,
    width: 1280,
    height: 960
  })),
  {
    elevation: 'elevated shot',
    distance: 'wide shot',
    azimuths: [
      14.5, 70, 98.5, 124, 125, 127, 132, 140, 150, 161, 196.5, 233, 248.5, 273,
      305, 327.5, 347
    ],
    width: 1112,
    height: 834
  },
  {
    elevation: 'elevated shot',
    distance: 'medium shot',
    azimuths: [
      0, 22, 64, 78, 90, 102, 113.5, 124, 125, 134, 159.5, 196.5, 246.5, 259.5,
      280, 302.5, 340.5
    ],
    width: 1112,
    height: 834
  },
  {
    elevation: 'elevated shot',
    distance: 'close-up',
    azimuths: [
      9, 21.5, 53.5, 74, 114, 132.5, 133.5, 168, 184.5, 203.5, 219, 244, 265,
      293.5, 321.5, 340, 350
    ],
    width: 1112,
    height: 834
  }
]

const slugify = (label: string) => label.replaceAll(' ', '-')

function ringAssets(ring: RingSpec): AngleAsset[] {
  return ring.azimuths.map((azimuthDegrees) => {
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
