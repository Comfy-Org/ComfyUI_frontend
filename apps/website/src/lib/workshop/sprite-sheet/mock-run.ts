import { mockJob } from '../mock-job'
import type {
  FrameCount,
  SpriteMotion,
  SpriteSetup,
  SpriteStyle
} from './options'
import { sheetGrid } from './options'
import { renderSpriteSheet } from './render-sheet'

/** What the Sprite Sheet backend receives for one run. */
export interface SpriteSheetRequest {
  /** The character, ideally on a transparent background. */
  readonly imageUrl: string
  readonly style: SpriteStyle
  readonly motion: SpriteMotion
  /** Frames in one loop of the motion. */
  readonly frames: FrameCount
  /** Frames to a row of the sheet; rows follow from `frames`. */
  readonly columns: number
  /** The square size of one frame, in pixels. */
  readonly frameSize: number
  readonly background: 'transparent'
  readonly seed: number
}

/** What a run answers: one PNG holding every frame, row by row. */
export interface SpriteSheetResult {
  readonly url: string
  readonly frames: number
  readonly columns: number
  readonly rows: number
  readonly frameSize: number
  readonly seed: number
}

/** Draws a request's sheet as an object URL, or undefined. */
export type SpriteSheetRender = (
  request: SpriteSheetRequest
) => Promise<string | undefined>

export const SPRITE_CREDITS = 30
const FRAME_SIZE = 256

const MOCK_DELAY_MS = 2400

export const SPRITE_EXAMPLE = {
  url: '/images/apps/sprite-sheet/example.png',
  name: 'fox-explorer.png',
  width: 512,
  height: 640
} as const

/** The request for a character and a setup. */
export function spriteSheetRequest(
  imageUrl: string,
  setup: SpriteSetup
): SpriteSheetRequest {
  return {
    imageUrl,
    style: setup.style,
    motion: setup.motion,
    frames: setup.frames,
    columns: sheetGrid(setup.frames).columns,
    frameSize: FRAME_SIZE,
    background: 'transparent',
    seed: setup.seed
  }
}

const renderInBrowser: SpriteSheetRender = (request) =>
  renderSpriteSheet(request.imageUrl, request)

/**
 * Stands in for the Sprite Sheet backend until it exists: waits, then
 * answers with frames drawn in the browser from the character (`render`),
 * posed for the motion and redrawn in the style. Where that cannot draw,
 * it answers with the character itself as a one-frame sheet. Replace this
 * with the real job call; the page only needs the same request and result.
 */
export async function runSpriteSheet(
  request: SpriteSheetRequest,
  signal: AbortSignal,
  render: SpriteSheetRender = renderInBrowser
): Promise<SpriteSheetResult> {
  const rendered = render(request).catch(() => undefined)
  try {
    await mockJob(undefined, signal, MOCK_DELAY_MS)
  } catch (error) {
    void rendered.then((url) => url && URL.revokeObjectURL(url))
    throw error
  }
  const url = await rendered
  if (!url)
    return {
      url: request.imageUrl,
      frames: 1,
      columns: 1,
      rows: 1,
      frameSize: request.frameSize,
      seed: request.seed
    }
  return {
    url,
    frames: request.frames,
    ...sheetGrid(request.frames),
    frameSize: request.frameSize,
    seed: request.seed
  }
}
