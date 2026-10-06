import { mockJob } from '../mock-job'
import type {
  SpriteSheetProgress,
  SpriteSheetRequest,
  SpriteSheetResult
} from './contract'
import type { SpriteStyle } from './options'
import { SPRITE_GRID } from './options'
import { renderSpriteSheet } from './render-sheet'

/** Draws a request's sheet as an object URL, or undefined. */
export type SpriteSheetRender = (
  request: SpriteSheetRequest
) => Promise<string | undefined>

export const SPRITE_CREDITS = 30

const QUEUE_MS = 400
const STEP_MS = 200
const STEPS = 10

const EXAMPLE = '/images/apps/sprite-sheet/explorer.webp'

export const SPRITE_EXAMPLE = {
  url: EXAMPLE,
  name: 'explorer.webp',
  width: 512,
  height: 640
} as const

const EXAMPLE_WALKS: Record<SpriteStyle, string> = {
  pixel: '/images/apps/sprite-sheet/explorer-walk-pixel.webp',
  toon: '/images/apps/sprite-sheet/explorer-walk-toon.webp',
  '3d': '/images/apps/sprite-sheet/explorer-walk-3d.webp'
}

/** The worked example's prepared walk in the request's style, if it is one. */
function preparedSheet(request: SpriteSheetRequest) {
  return request.image === EXAMPLE && request.motion === 'walk'
    ? EXAMPLE_WALKS[request.style]
    : undefined
}

const renderInBrowser: SpriteSheetRender = (request) => {
  const prepared = preparedSheet(request)
  return prepared
    ? Promise.resolve(prepared)
    : renderSpriteSheet(request.image, request)
}

/**
 * Stands in for the Sprite sheet backend until it exists: queues, counts
 * up to 100%, then answers with frames drawn in the browser from the
 * character (`render`), posed for the motion and redrawn in the style, or,
 * for the worked example's walk, its prepared sheet in that style. The
 * free-text animation is sent but not drawn. Where nothing can be drawn it
 * answers with the character itself as a one-frame sheet. Replace this
 * with the real job call; the page only needs the same request, progress
 * and result.
 */
export async function runSpriteSheet(
  request: SpriteSheetRequest,
  signal: AbortSignal,
  {
    onProgress = () => {},
    render = renderInBrowser
  }: {
    onProgress?: (progress: SpriteSheetProgress) => void
    render?: SpriteSheetRender
  } = {}
): Promise<SpriteSheetResult> {
  const rendered = render(request).catch(() => undefined)
  try {
    onProgress({ stage: 'queued' })
    await mockJob(undefined, signal, QUEUE_MS)
    for (let step = 0; step < STEPS; step++) {
      onProgress({ stage: 'running', percent: (step * 100) / STEPS })
      await mockJob(undefined, signal, STEP_MS)
    }
  } catch (error) {
    void rendered.then((url) => url && URL.revokeObjectURL(url))
    throw error
  }
  const url = await rendered
  if (!url)
    return {
      url: request.image,
      frames: 1,
      columns: 1,
      rows: 1,
      seed: request.seed
    }
  return { url, ...SPRITE_GRID, seed: request.seed }
}
