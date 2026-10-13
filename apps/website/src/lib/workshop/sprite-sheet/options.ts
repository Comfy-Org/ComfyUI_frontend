import type { SpriteCopyKey } from './copy'

export const SPRITE_STYLES = ['pixel', 'toon', '3d'] as const
export type SpriteStyle = (typeof SPRITE_STYLES)[number]

export const SPRITE_MOTIONS = ['idle', 'walk', 'jump'] as const
export type SpriteMotion = (typeof SPRITE_MOTIONS)[number]

const FRAME_RATES = [6, 8, 12] as const
export type FrameRate = (typeof FRAME_RATES)[number]

export const STYLE_LABELS = {
  pixel: 'sprite.style.pixel',
  toon: 'sprite.style.toon',
  '3d': 'sprite.style.3d'
} as const satisfies Record<SpriteStyle, SpriteCopyKey>

export const MOTION_LABELS = {
  idle: 'sprite.motion.idle',
  walk: 'sprite.motion.walk',
  jump: 'sprite.motion.jump'
} as const satisfies Record<SpriteMotion, SpriteCopyKey>

/** Every sheet holds one loop of eight frames, four to a row. */
export const SPRITE_GRID = { frames: 8, columns: 4, rows: 2 } as const

/** Everything undo and redo cover, and what a run sends. */
export interface SpriteSetup {
  /** The animation in the visitor's words, such as "dancing"; may be empty. */
  readonly description: string
  readonly style: SpriteStyle
  readonly motion: SpriteMotion
  readonly seed: number
}

export const DEFAULT_SETUP: SpriteSetup = {
  description: '',
  style: 'pixel',
  motion: 'walk',
  seed: 1234
}

/** The frame rate after `current`, wrapping round to the slowest. */
export function nextFrameRate(current: FrameRate): FrameRate {
  const at = FRAME_RATES.indexOf(current)
  return FRAME_RATES[(at + 1) % FRAME_RATES.length]
}
