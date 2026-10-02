import type { RelightCopyKey } from './copy'

export type LightKind = 'point' | 'directional'
export const MOOD_IDS = [
  'studio',
  'sunset',
  'split',
  'window',
  'neon',
  'moonlight'
] as const
export type MoodId = (typeof MOOD_IDS)[number]

export interface Light {
  readonly id: string
  readonly name: string
  readonly kind: LightKind
  /** Position as a fraction of the image width, 0 to 1. */
  readonly x: number
  /** Position as a fraction of the image height, 0 to 1. */
  readonly y: number
  /** `#rrggbb`. */
  readonly color: string
  /** 0 to 100. */
  readonly intensity: number
  /** 0 to 100. How far a point light reaches and how gently it wraps. */
  readonly softness: number
  /** Degrees, -180 to 180: where a directional light shines, 0 is right. */
  readonly direction: number
  /** Degrees, -90 to 90: 90 shines from the camera, -90 from behind. */
  readonly elevation: number
  readonly shadows: boolean
  readonly visible: boolean
  /** The mask this light is kept inside, or the whole image. */
  readonly mask?: string
}

/** A subject mask, mocked as a feathered ellipse until segmentation exists. */
export interface RelightMask {
  readonly id: string
  readonly name: string
  readonly visible: boolean
  readonly cx: number
  readonly cy: number
  readonly rx: number
  readonly ry: number
}

export type RelightMaskArea = Omit<RelightMask, 'visible'>

export interface RelightScene {
  /** 0 to 100. */
  readonly ambient: number
  /** `#rrggbb`. */
  readonly ambientColor: string
  /** 0 to 100. */
  readonly removeOriginal: number
  /** 0 to 100. */
  readonly reflections: number
}

type GenerateArea = 'whole' | 'masked'

export interface RelightGeneration {
  readonly prompt: string
  /** 0 to 100, how far the result may move from the photo. */
  readonly strength: number
  readonly area: GenerateArea
  readonly seed: number
}

export const MAX_LIGHTS = 4

export const LIGHT_COLORS = [
  { hex: '#ffb35c', name: 'relight.color.warm' },
  { hex: '#ffe2b8', name: 'relight.color.cream' },
  { hex: '#ffffff', name: 'relight.color.white' },
  { hex: '#8cb8ff', name: 'relight.color.cool' },
  { hex: '#ff5fd2', name: 'relight.color.magenta' }
] as const satisfies readonly { hex: string; name: RelightCopyKey }[]

const [WARM, CREAM, WHITE, COOL, MAGENTA] = LIGHT_COLORS.map(({ hex }) => hex)

export const DEFAULT_SCENE: RelightScene = {
  ambient: 15,
  ambientColor: WHITE,
  removeOriginal: 80,
  reflections: 20
}

export const DEFAULT_GENERATION: RelightGeneration = {
  prompt: '',
  strength: 50,
  area: 'whole',
  seed: 1234
}

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value))

/** The way a directional light at a spot shines: across, toward the middle. */
export function directionToCenter(x: number, y: number): number {
  if (Math.hypot(0.5 - x, 0.5 - y) < 0.01) return 45
  return Math.round((Math.atan2(0.5 - y, 0.5 - x) * 180) / Math.PI)
}

type LightSeed = Pick<
  Light,
  'kind' | 'color' | 'x' | 'y' | 'intensity' | 'softness' | 'elevation'
> & { readonly name: RelightCopyKey }

const seed = (
  name: RelightCopyKey,
  kind: LightKind,
  color: string,
  [x, y]: readonly [number, number],
  intensity: number,
  softness: number,
  elevation = 35
): LightSeed => ({ name, kind, color, x, y, intensity, softness, elevation })

/** Where a mood aims its directional lights: a subject right of centre. */
const SUBJECT = { x: 0.6, y: 0.42 }

const aim = (x: number, y: number) =>
  Math.round((Math.atan2(SUBJECT.y - y, SUBJECT.x - x) * 180) / Math.PI)

const MOODS = {
  studio: [
    seed('relight.light.key', 'point', CREAM, [0.48, 0.12], 100, 70),
    seed('relight.light.fill', 'point', WHITE, [0.88, 0.55], 40, 85)
  ],
  sunset: [
    seed('relight.light.warmKey', 'directional', WARM, [0.12, 0.3], 85, 45, 15),
    seed('relight.light.coolFill', 'point', COOL, [0.9, 0.6], 30, 70)
  ],
  split: [
    seed('relight.light.key', 'directional', WHITE, [0.3, 0.42], 100, 10, 5)
  ],
  window: [
    seed('relight.light.window', 'directional', WHITE, [0.1, 0.3], 70, 85, 30)
  ],
  neon: [
    seed('relight.light.pink', 'point', MAGENTA, [0.42, 0.3], 75, 45),
    seed('relight.light.blue', 'point', COOL, [0.8, 0.38], 90, 45)
  ],
  moonlight: [
    seed('relight.light.moon', 'directional', COOL, [0.85, 0.1], 65, 50, 25)
  ]
} as const satisfies Record<MoodId, readonly LightSeed[]>

const MOOD_AMBIENT = {
  studio: 25,
  sunset: 15,
  split: 4,
  window: 20,
  neon: 8,
  moonlight: 6
} as const satisfies Record<MoodId, number>

/** The scene with a mood's ambient light: darker moods let less spill in. */
export function moodScene(mood: MoodId, scene: RelightScene): RelightScene {
  return { ...scene, ambient: MOOD_AMBIENT[mood] }
}

/** A mood's lights, named in the visitor's language. */
export function moodLights(
  mood: MoodId,
  name: (key: RelightCopyKey) => string
): Light[] {
  return MOODS[mood].map((light, index) => ({
    ...light,
    id: `${mood}-${index + 1}`,
    name: name(light.name),
    direction: aim(light.x, light.y),
    shadows: true,
    visible: true
  }))
}

/** Moves a light by a delta without letting it leave the image. */
export function moveLight(light: Light, dx: number, dy: number): Light {
  return { ...light, x: clamp(light.x + dx), y: clamp(light.y + dy) }
}

const ADD_SPOTS = [
  [0.5, 0.2],
  [0.3, 0.6],
  [0.7, 0.6],
  [0.5, 0.8]
] as const

/** A fresh white light, set where the lights already there leave room. */
export function newLight(
  id: string,
  name: string,
  count: number,
  kind: LightKind = 'point'
): Light {
  const [x, y] = ADD_SPOTS[count % ADD_SPOTS.length]
  return {
    id,
    name,
    kind,
    x,
    y,
    color: WHITE,
    intensity: 60,
    softness: 50,
    direction: directionToCenter(x, y),
    elevation: 35,
    shadows: true,
    visible: true
  }
}

const MASK_SHAPES = [
  { cx: 0.5, cy: 0.55, rx: 0.3, ry: 0.5 },
  { cx: 0.5, cy: 0.35, rx: 0.2, ry: 0.32 },
  { cx: 0.5, cy: 0.8, rx: 0.45, ry: 0.3 },
  { cx: 0.3, cy: 0.5, rx: 0.25, ry: 0.45 }
] as const

/**
 * A stand-in for segmenting `name` out of the photo: a feathered ellipse
 * around where subjects usually sit, a different one for each new mask.
 */
export function newMask(id: string, name: string, count: number): RelightMask {
  return {
    id,
    name,
    visible: false,
    ...MASK_SHAPES[count % MASK_SHAPES.length]
  }
}

export const MOOD_LABELS = {
  studio: 'relight.mood.studio',
  sunset: 'relight.mood.sunset',
  split: 'relight.mood.split',
  window: 'relight.mood.window',
  neon: 'relight.mood.neon',
  moonlight: 'relight.mood.moonlight'
} as const satisfies Record<MoodId, RelightCopyKey>
