import type { WorkshopModelDetail } from '../../../config/models-catalogue'
import { canRunModel } from './gate'

type ModelLookup = (
  slug: string
) =>
  | Pick<
      WorkshopModelDetail,
      'slug' | 'name' | 'provider' | 'execution' | 'incompleteReason'
    >
  | undefined

export interface CinematicModel {
  readonly slug: string
  readonly name: string
  readonly provider: string
  readonly logo: string
}

const CINEMATIC_MODEL_LOGOS: Readonly<Record<string, string>> = {
  'byteplus--seedream-4-5--generate-images': '/icons/ai-models/bytedance.svg',
  'vertexai--gemini-3-pro-image--generate-images':
    '/icons/ai-models/gemini.svg',
  'bfl--flux-2-pro--generate-images': '/icons/ai-models/bfl.svg',
  'krea--krea-2-large--generate-images': '/icons/ai-models/krea.svg',
  'qwen--qwen-image-3.0-pro-text-to-image--generate-images':
    '/icons/ai-models/qwen.svg'
}

export function isCinematicModel(slug: string): boolean {
  return Object.hasOwn(CINEMATIC_MODEL_LOGOS, slug)
}

export function runnableCinematicModels(
  lookup: ModelLookup
): readonly CinematicModel[] {
  return Object.entries(CINEMATIC_MODEL_LOGOS).flatMap(([slug, logo]) => {
    const model = lookup(slug)
    return model && canRunModel(model)
      ? [
          {
            slug: model.slug,
            name: model.name,
            provider: model.provider ?? '',
            logo
          }
        ]
      : []
  })
}
