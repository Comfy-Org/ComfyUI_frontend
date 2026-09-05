import type { WorkshopBrowseModel } from './workshop'

/**
 * The models the homepage leads with, in display order.
 *
 * Hand-picked rather than derived: this is the first thing a visitor sees, so
 * the choice is editorial (recognisable names, one per output type) and not
 * something a ranking heuristic should be quietly changing on every catalog
 * regeneration.
 */
export const FEATURED_WORKSHOP_MODEL_IDS: readonly string[] = [
  'bfl/flux-2-pro',
  'vertexai/gemini-3-pro-image',
  'kling/text-to-video',
  'elevenlabs/text-to-speech',
  'sonilo/text-to-music',
  'tencent-hunyuan3d/image-to-model-3.1'
]

/**
 * Resolves the featured ids against the catalog, preserving the order above.
 *
 * An id the catalog no longer has is skipped rather than thrown on: the
 * catalog is regenerated from whatever Router is currently serving, and a
 * partner retiring a model should not take the homepage build down with it.
 * `workshop-featured.test.ts` asserts every id still resolves, so the list
 * going stale is a failing test rather than a silently shorter homepage.
 */
export function featuredWorkshopModels(
  models: readonly WorkshopBrowseModel[]
): WorkshopBrowseModel[] {
  const byId = new Map(models.map((model) => [model.id, model]))
  return FEATURED_WORKSHOP_MODEL_IDS.map((id) => byId.get(id)).filter(
    (model): model is WorkshopBrowseModel => model !== undefined
  )
}
