import type { SpriteCopyKey } from './copy'

export const SPRITE_STYLES = ['pixel', 'toon', '3d'] as const
export type SpriteStyle = (typeof SPRITE_STYLES)[number]

export const SPRITE_MOTIONS = ['idle', 'walk', 'jump'] as const
export type SpriteMotion = (typeof SPRITE_MOTIONS)[number]

export const FRAME_COUNTS = [4, 8, 12] as const
export type FrameCount = (typeof FRAME_COUNTS)[number]

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

/** Everything undo and redo cover, and what a run sends. */
export interface SpriteSetup {
  readonly style: SpriteStyle
  readonly motion: SpriteMotion
  readonly frames: FrameCount
  readonly seed: number
}

export const DEFAULT_SETUP: SpriteSetup = {
  style: 'pixel',
  motion: 'walk',
  frames: 8,
  seed: 1234
}

const COLUMNS = 4

/** How a sheet of `frames` frames is laid out: four to a row. */
export function sheetGrid(frames: number): { columns: number; rows: number } {
  const columns = Math.min(COLUMNS, Math.max(1, frames))
  return { columns, rows: Math.max(1, Math.ceil(frames / columns)) }
}

/** The frame rate after `current`, wrapping round to the slowest. */
export function nextFrameRate(current: FrameRate): FrameRate {
  const at = FRAME_RATES.indexOf(current)
  return FRAME_RATES[(at + 1) % FRAME_RATES.length]
}
