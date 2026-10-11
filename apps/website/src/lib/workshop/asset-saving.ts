/**
 * The Router keeps a generation only for the operations whose output shape its
 * extractor knows. Asking for saving anywhere else is not a run whose outputs
 * go unkept: submit refuses it before generation, so an otherwise runnable
 * model page stops working the moment the flag goes on.
 *
 * Mirrors `routerassets.extractors` in Comfy-Org/cloud at 651c8450c3de. A
 * model the Router learns to keep is silently left out until this list
 * follows, which is the safe direction to be wrong in.
 */
const SAVING_OPERATIONS = [
  'xai/v1/images/generations',
  'xai/v1/images/edits',
  'xai/v1/videos/generations',
  'xai/v1/videos/edits',
  'xai/v1/videos/extensions',
  'fal/openai/gpt-image-2',
  'fal/fal-ai/nano-banana-2',
  'fal/fal-ai/nano-banana-pro',
  'fal/minimax/h3-max/text-to-video',
  'fal/minimax/h3-max-turbo/text-to-video',
  'fal/bytedance/seedance-2.0/text-to-video',
  'fal/bytedance/seedance-2.5/text-to-video',
  'heygen/v3/voices/speech',
  'bfl/flux-pro-1.1-ultra/generate',
  'bfl/flux-pro-1.1/generate',
  'bfl/flux-kontext-pro/generate',
  'bfl/flux-kontext-max/generate',
  'bfl/flux-2-pro/generate',
  'bfl/flux-2-max/generate',
  'bfl/flux-pro-1.0-expand/generate',
  'bfl/flux-pro-1.0-fill/generate',
  'bfl/flux-pro-1.0-canny/generate',
  'bfl/flux-pro-1.0-depth/generate'
] as const

/** A model id names a model; an operation names a model and the endpoint the
 * Router calls it through, which the catalogue does not carry. */
export function routerSavesAssets(routerId: string | undefined): boolean {
  return (
    routerId !== undefined &&
    SAVING_OPERATIONS.some(
      (operation) =>
        operation === routerId || operation.startsWith(`${routerId}/`)
    )
  )
}
