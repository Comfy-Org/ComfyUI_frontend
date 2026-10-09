import type { SpriteMotion, SpriteSetup, SpriteStyle } from './options'

/**
 * What the Sprite sheet backend receives for one run, as the multipart
 * fields of `POST /api/run/sprite-generator`: `image` is sent as the file.
 */
export interface SpriteSheetRequest {
  /** The character, ideally on a transparent background. */
  readonly image: string
  /** The animation in the visitor's words; empty leaves it to `motion`. */
  readonly description: string
  readonly style: SpriteStyle
  readonly motion: SpriteMotion
  readonly seed: number
}

/** What a run answers: one PNG holding every frame, row by row. */
export interface SpriteSheetResult {
  readonly url: string
  readonly frames: number
  readonly columns: number
  readonly rows: number
  readonly seed: number
}

/** How far a run has got, for the wait on the stage. */
export type SpriteSheetProgress =
  | { readonly stage: 'queued' }
  | { readonly stage: 'running'; readonly percent: number }

/** The request for a character and a setup. */
export function spriteSheetRequest(
  image: string,
  setup: SpriteSetup
): SpriteSheetRequest {
  return {
    image,
    description: setup.description.trim(),
    style: setup.style,
    motion: setup.motion,
    seed: setup.seed
  }
}
