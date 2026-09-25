import type { WorkshopModelDetail } from '../../../config/models-catalogue'
import {
  createRouterParameters,
  routerParameterMappings
} from '../../../config/router-parameters'
import type { WorkshopContract } from '../../../config/workshop-contract'
import { formForContract } from '../../../config/workshop-contract'
import {
  defaultValues,
  schemaForModel
} from '../../../config/workshop-playground'
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
  readonly seed?: CinematicSeedDescriptor
  readonly referenceModelSlug?: string
  readonly referenceMax?: number
}

function referenceCapacity(contract: WorkshopContract): number {
  const schema = schemaForModel({ fields: [], form: formForContract(contract) })
  const mappings = routerParameterMappings(contract)
  return schema.reduce((total, field) => {
    if (field.kind !== 'file') return total
    const mapped = createRouterParameters(
      [field],
      defaultValues([field]),
      mappings
    ).router_get_closest_value([], 'reference_images')
    return total + (mapped !== undefined ? (field.maxItems ?? 1) : 0)
  }, 0)
}

const REFERENCE_ROUTES: Readonly<Record<string, string>> = {
  'byteplus--seedream-4-5--generate-images':
    'byteplus--seedream-4-5--edit-images',
  'vertexai--gemini-3-pro-image--generate-images':
    'vertexai--gemini-3-pro-image--edit-images'
}

interface CinematicSeedDescriptor {
  readonly minimum?: number
  readonly maximum?: number
  readonly step: number | 'any'
}

function cinematicSeedDescriptor(
  contract: WorkshopContract
): CinematicSeedDescriptor | undefined {
  const schema = schemaForModel({ fields: [], form: formForContract(contract) })
  const mappings = routerParameterMappings(contract)
  const field = schema.find(
    (candidate) =>
      candidate.kind === 'number' &&
      typeof createRouterParameters(
        [candidate],
        defaultValues([candidate]),
        mappings
      ).router_get_closest_value(0, 'seed') === 'number'
  )
  if (field?.kind !== 'number') return
  return {
    ...(field.min !== undefined ? { minimum: field.min } : {}),
    ...(field.max !== undefined ? { maximum: field.max } : {}),
    step: field.step
  }
}

const VIDEO_SLUGS = new Set([
  'byteplus--seedance-2-5-text-to-video--generate-videos',
  'byteplus--seedance-2-5-first-last-frame--animate-images',
  'wan--text-to-video--generate-videos',
  'wan--image-to-video--animate-images',
  'wan--text-to-video-2.7--generate-videos',
  'wan--image-to-video-2.7--animate-images',
  'wan--text-to-video-3.0--generate-videos',
  'wan--image-to-video-3.0--animate-images',
  'wan--text-to-video-3.0-prime--generate-videos',
  'wan--image-to-video-3.0-prime--animate-images',
  'ltx--text-to-video-v2--generate-videos'
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
    '/icons/ai-models/bytedance.svg',
  ...Object.fromEntries(
    [...VIDEO_SLUGS]
      .filter((slug) => slug.startsWith('wan--') || slug.startsWith('ltx--'))
      .map((slug) => [
        slug,
        slug.startsWith('wan--')
          ? '/icons/ai-models/wan.svg'
          : '/icons/ai-models/ltxv.svg'
      ])
  )
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
    const seed = model?.execution
      ? cinematicSeedDescriptor(model.execution)
      : undefined
    const referenceModel = VIDEO_SLUGS.has(slug)
      ? undefined
      : REFERENCE_ROUTES[slug]
        ? lookup(REFERENCE_ROUTES[slug])
        : model
    const referenceMax =
      referenceModel?.execution && canRunModel(referenceModel)
        ? referenceCapacity(referenceModel.execution)
        : 0
    return model && canRunModel(model)
      ? [
          {
            slug: model.slug,
            name: model.name.replace(/ Text-to-Image$/, ''),
            provider: model.provider ?? '',
            logo,
            ...(seed ? { seed } : {}),
            ...(referenceMax && referenceModel
              ? { referenceModelSlug: referenceModel.slug, referenceMax }
              : {}),
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
