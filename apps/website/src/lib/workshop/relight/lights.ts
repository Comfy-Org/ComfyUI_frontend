import type { RelightCopyKey } from './copy'

export type LightKind = 'point' | 'directional'
export type LightColor = 'warm' | 'cream' | 'white' | 'cool' | 'magenta'
export const MOOD_IDS = [
  'studio',
  'sunset',
  'window',
  'split',
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
  readonly color: LightColor
  /** 0 to 100. */
  readonly brightness: number
  /** 0 to 100. */
  readonly softness: number
  readonly visible: boolean
}

export interface RelightScene {
  readonly shadows: boolean
  /** 0 to 100. */
  readonly ambient: number
  /** 0 to 100. */
  readonly removeOriginal: number
  readonly prompt: string
}

export const MAX_LIGHTS = 4

export const LIGHT_COLORS = [
  { id: 'warm', hex: '#ffb35c', name: 'relight.color.warm' },
  { id: 'cream', hex: '#ffe2b8', name: 'relight.color.cream' },
  { id: 'white', hex: '#ffffff', name: 'relight.color.white' },
  { id: 'cool', hex: '#8cb8ff', name: 'relight.color.cool' },
  { id: 'magenta', hex: '#ff5fd2', name: 'relight.color.magenta' }
] as const satisfies readonly {
  id: LightColor
  hex: string
  name: RelightCopyKey
}[]

export function lightHex(color: LightColor): string {
  return LIGHT_COLORS.find((swatch) => swatch.id === color)?.hex ?? '#ffffff'
}

export const DEFAULT_SCENE: RelightScene = {
  shadows: true,
  ambient: 30,
  removeOriginal: 40,
  prompt: ''
}

type LightSeed = Omit<Light, 'id' | 'name' | 'visible'> & {
  readonly name: RelightCopyKey
}

const seed = (
  name: RelightCopyKey,
  kind: LightKind,
  color: LightColor,
  x: number,
  y: number,
  brightness: number,
  softness: number
): LightSeed => ({ name, kind, color, x, y, brightness, softness })

const MOODS = {
  studio: [
    seed('relight.light.key', 'point', 'cream', 0.25, 0.28, 75, 55),
    seed('relight.light.fill', 'point', 'white', 0.8, 0.45, 35, 80)
  ],
  sunset: [
    seed('relight.light.warmKey', 'directional', 'warm', 0.2, 0.3, 80, 45),
    seed('relight.light.coolFill', 'point', 'cool', 0.85, 0.55, 30, 70)
  ],
  window: [
    seed('relight.light.window', 'directional', 'white', 0.08, 0.35, 70, 85)
  ],
  split: [seed('relight.light.key', 'point', 'white', 0.04, 0.45, 85, 25)],
  neon: [
    seed('relight.light.pink', 'point', 'magenta', 0.15, 0.4, 70, 40),
    seed('relight.light.blue', 'point', 'cool', 0.85, 0.4, 70, 40)
  ],
  moonlight: [
    seed('relight.light.moon', 'directional', 'cool', 0.7, 0.12, 45, 60)
  ]
} as const satisfies Record<MoodId, readonly LightSeed[]>

/** A mood's lights, named in the visitor's language. */
export function moodLights(
  mood: MoodId,
  name: (key: RelightCopyKey) => string
): Light[] {
  return MOODS[mood].map((light, index) => ({
    ...light,
    id: `${mood}-${index + 1}`,
    name: name(light.name),
    visible: true
  }))
}

const clamp = (value: number) => Math.min(1, Math.max(0, value))

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

/** A fresh white point light, set where the lights already there leave room. */
export function newLight(id: string, name: string, count: number): Light {
  const [x, y] = ADD_SPOTS[count % ADD_SPOTS.length]
  return {
    id,
    name,
    kind: 'point',
    x,
    y,
    color: 'white',
    brightness: 60,
    softness: 50,
    visible: true
  }
}

export const MOOD_LABELS = {
  studio: 'relight.mood.studio',
  sunset: 'relight.mood.sunset',
  window: 'relight.mood.window',
  split: 'relight.mood.split',
  neon: 'relight.mood.neon',
  moonlight: 'relight.mood.moonlight'
} as const satisfies Record<MoodId, RelightCopyKey>
