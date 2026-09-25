import type { WorkshopModelDetail } from '../../../config/models-catalogue'
import { canRunModel } from './gate'
import type { CinematicVideoDescriptor } from './video'
import { cinematicVideoDescriptor } from './video'

type ModelLookup = (
  slug: string
) =>
  | Pick<
      WorkshopModelDetail,
      'slug' | 'name' | 'provider' | 'execution' | 'incompleteReason' | 'status'
    >
  | undefined

export interface CinematicModel {
  readonly slug: string
  readonly name: string
  readonly provider: string
  readonly logo: string
  readonly degraded?: boolean
  readonly mode?: 'image' | 'video'
  readonly video?: CinematicVideoDescriptor
}

const VIDEO_SLUGS = new Set([
  'byteplus--seedance-2-5-text-to-video--generate-videos',
  'byteplus--seedance-2-5-first-last-frame--animate-images'
])

const CINEMATIC_MODEL_LOGOS: Readonly<Record<string, string>> = {
  'byteplus--seedream-4-5--generate-images': '/icons/ai-models/bytedance.svg',
  'vertexai--gemini-3-pro-image--generate-images':
    '/icons/ai-models/gemini.svg',
  'bfl--flux-2-pro--generate-images': '/icons/ai-models/bfl.svg',
  'krea--krea-2-large--generate-images': '/icons/ai-models/krea.svg',
  'qwen--qwen-image-3.0-pro-text-to-image--generate-images':
    '/icons/ai-models/qwen.svg',
  'byteplus--seedance-2-5-text-to-video--generate-videos':
    '/icons/ai-models/bytedance.svg',
  'byteplus--seedance-2-5-first-last-frame--animate-images':
    '/icons/ai-models/bytedance.svg'
}

export function runnableCinematicModels(
  lookup: ModelLookup
): readonly CinematicModel[] {
  return Object.entries(CINEMATIC_MODEL_LOGOS).flatMap(([slug, logo]) => {
    const model = lookup(slug)
    const video =
      VIDEO_SLUGS.has(slug) && model?.execution
        ? cinematicVideoDescriptor(model.execution)
        : undefined
    if (VIDEO_SLUGS.has(slug) && !video) return []
    return model && canRunModel(model)
      ? [
          {
            slug: model.slug,
            name: model.name.replace(/ Text-to-Image$/, ''),
            provider: model.provider ?? '',
            logo,
            ...(video ? { mode: 'video' as const, video } : {}),
            ...(model.status === 'degraded' ? { degraded: true } : {})
          }
        ]
      : []
  })
}

export function cinematicStudioHref(
  slug: string,
  studioRoute: string
): string | undefined {
  return slug in CINEMATIC_MODEL_LOGOS
    ? `${studioRoute}?model=${encodeURIComponent(slug)}`
    : undefined
}
