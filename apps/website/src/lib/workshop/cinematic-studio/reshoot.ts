/**
 * The Re-shoot prototype: the CrossView Warp app (#18691) in the Cinematic
 * Studio's review switcher. Jobs run on a dedicated Comfy API deployment
 * (see reshoot-engine/); the worked example's clip and result come from the
 * media CDN.
 */
const MEDIA = 'https://media.comfy.org/website/workshop/crossview'

export const RESHOOT_EXAMPLE = {
  name: 'input_crossviewwarp-1.mp4',
  clip: `${MEDIA}/example-input.mp4`,
  result: `${MEDIA}/example-result.mp4`
} as const

const MIN_SECONDS = 5
const MAX_SECONDS = 15

export function clipFits(seconds: number): boolean {
  return seconds >= MIN_SECONDS && seconds <= MAX_SECONDS
}

const RESHOOT_FPS = 24
export const RESHOOT_FRAMES = 17 * 11 + 5

export interface ReshootCamera {
  azimuth: number
  elevation: number
  distance: number
  fov: number
  shift: number
}

export type CameraAxis = keyof ReshootCamera

export const DEFAULT_CAMERA: Readonly<ReshootCamera> = {
  azimuth: -30,
  elevation: 15,
  distance: 1,
  fov: 50,
  shift: 0
}

export const CAMERA_RANGES: Readonly<
  Record<CameraAxis, { min: number; max: number; step: number }>
> = {
  azimuth: { min: -90, max: 90, step: 1 },
  elevation: { min: -45, max: 45, step: 1 },
  distance: { min: 0.1, max: 3, step: 0.05 },
  fov: { min: 20, max: 120, step: 1 },
  shift: { min: -0.5, max: 0.5, step: 0.05 }
}

export function clampAxis(axis: CameraAxis, value: number): number {
  const { min, max } = CAMERA_RANGES[axis]
  return Math.min(max, Math.max(min, value))
}

export type ReshootZone = 'green' | 'yellow' | 'red'

/**
 * The ranges the CrossView LoRA was trained on, as the node's own orbit
 * picker draws them: ellipses of (azimuth, elevation up, elevation down).
 * Green is where the model has been checked; yellow is trained but looser.
 */
const ZONE_GREEN = [45, 30, 20] as const
const ZONE_YELLOW = [90, 45, 35] as const

export function cameraZone({ azimuth, elevation }: ReshootCamera): ReshootZone {
  const inside = ([turn, up, down]: readonly number[]) => {
    const a = azimuth / turn
    const e = elevation >= 0 ? elevation / up : elevation / down
    return a * a + e * e <= 1
  }
  if (inside(ZONE_GREEN)) return 'green'
  if (inside(ZONE_YELLOW)) return 'yellow'
  return 'red'
}

export function viewTransform({
  azimuth,
  elevation,
  distance,
  shift
}: ReshootCamera): string {
  const scale = 1 / (0.65 + 0.35 * distance)
  return `perspective(1400px) translateY(${shift * 20}%) rotateY(${azimuth * 0.3}deg) rotateX(${-elevation * 0.3}deg) scale(${scale.toFixed(3)})`
}

export const RESHOOT_ASPECTS = [
  'source',
  '16:9',
  '9:16',
  '1:1',
  '4:3',
  '3:4',
  '21:9'
] as const
export type ReshootAspect = (typeof RESHOOT_ASPECTS)[number]

export const RESHOOT_SIZES = ['480p', '768p'] as const
export type ReshootSize = (typeof RESHOOT_SIZES)[number]

export const RESHOOT_MOTIONS = [
  'linear',
  'ease_in',
  'ease_out',
  'ease_in_out',
  'smooth'
] as const
export type ReshootMotion = (typeof RESHOOT_MOTIONS)[number]

export interface CameraKey {
  readonly frame: number
  readonly camera: Readonly<ReshootCamera>
}

export function withKey(
  keys: readonly CameraKey[],
  key: CameraKey
): CameraKey[] {
  return [...keys.filter((entry) => entry.frame !== key.frame), key].sort(
    (a, b) => a.frame - b.frame
  )
}

export function frameTime(frame: number): string {
  return `${(frame / RESHOOT_FPS).toFixed(1)} s`
}
