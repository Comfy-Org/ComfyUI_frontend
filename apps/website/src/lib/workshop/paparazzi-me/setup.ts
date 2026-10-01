import type { PaparazziCopyKey } from './copy'

export const SCENE_IDS = [
  'red-carpet',
  'street-night',
  'cafe',
  'airport'
] as const
export type SceneId = (typeof SCENE_IDS)[number]

export const SCENE_LABELS = {
  'red-carpet': 'paparazzi.scene.redCarpet',
  'street-night': 'paparazzi.scene.streetNight',
  cafe: 'paparazzi.scene.cafe',
  airport: 'paparazzi.scene.airport'
} as const satisfies Record<SceneId, PaparazziCopyKey>

export const RESOLUTIONS = ['1K', '2K', '4K'] as const
export type Resolution = (typeof RESOLUTIONS)[number]

const LONG_EDGE = { '1K': 1024, '2K': 2048, '4K': 4096 } as const

/** A landscape 3:2 frame, the shape of a press photo, at `resolution`. */
export function outputSize(resolution: Resolution) {
  const width = LONG_EDGE[resolution]
  return { width, height: Math.round((width * 2) / 3) }
}

/** Everything undo and redo cover. */
export interface PaparazziSetup {
  readonly celebrity: string
  readonly scene: SceneId
  /** Free text that replaces the preset scene when it is not blank. */
  readonly sceneOverride: string
  readonly resolution: Resolution
  readonly seed: number
}

const MIN_CELEBRITY_LENGTH = 2
export const MAX_SEED = 2_147_483_647

export const DEFAULT_SETUP: PaparazziSetup = {
  celebrity: 'Nova Reyes',
  scene: 'red-carpet',
  sceneOverride: '',
  resolution: '2K',
  seed: 1207
}

/** Made-up stars for the lookup, so no real person is suggested. */
export const STARS = [
  { name: 'Nova Reyes', role: 'paparazzi.star.film' },
  { name: 'Orion Vale', role: 'paparazzi.star.music' },
  { name: 'Sable Quinn', role: 'paparazzi.star.tv' },
  { name: 'Marlo Vance', role: 'paparazzi.star.sport' },
  { name: 'Indigo Fairweather', role: 'paparazzi.star.film' },
  { name: 'Theo Lark', role: 'paparazzi.star.music' }
] as const satisfies readonly { name: string; role: PaparazziCopyKey }[]

export type Star = (typeof STARS)[number]

/** The stars whose name holds every word of `query`, all of them if blank. */
export function matchStars(query: string): readonly Star[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return STARS.filter((star) =>
    words.every((word) => star.name.toLowerCase().includes(word))
  )
}

export function isCustomScene(setup: PaparazziSetup): boolean {
  return setup.sceneOverride.trim().length > 0
}

export function hasCelebrity(setup: PaparazziSetup): boolean {
  return setup.celebrity.trim().length >= MIN_CELEBRITY_LENGTH
}

/** The seed after `seed`: the same walk every time, never zero. */
export function nextSeed(seed: number): number {
  return (seed * 48_271) % MAX_SEED || 1
}
