import type { WorkshopModelDetail } from '../../../config/models-catalogue'
import {
  createRouterParameters,
  mapRouterParameters,
  routerParameterMappings
} from '../../../config/router-parameters'
import type { WorkshopContract } from '../../../config/workshop-contract'
import { formForContract } from '../../../config/workshop-contract'
import {
  defaultValues,
  schemaForModel,
  urlUploadField
} from '../../../config/workshop-playground'
import { canRunModel } from './gate'
import { dimensions } from '../../../config/router-parameter-options'
import { workshopPageSchema } from '../../../config/workshop-page-state'
import { WorkshopRouterError } from '../../../config/workshop-router-errors'
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
  readonly imageAspects?: readonly string[]
}

const IMAGE_ASPECTS = [
  '21:9',
  '16:9',
  '4:3',
  '1:1',
  '9:16',
  '3:2',
  '2:3',
  '3:4'
]
function imageAspectOptions(contract: WorkshopContract): readonly string[] {
  const schema = schemaForModel({ fields: [], form: formForContract(contract) })
  const shapes = schema.flatMap((field) =>
    field.kind === 'select' && /(?:size|aspect|ratio)/i.test(field.name)
      ? field.options.flatMap((option) => dimensions(option) ?? [])
      : []
  )
  return shapes.length
    ? IMAGE_ASPECTS.filter((aspect) => {
        const ratio = dimensions(aspect)!
        return shapes.some(
          (shape) =>
            Math.abs(shape.width / shape.height - ratio.width / ratio.height) <
            0.001
        )
      })
    : IMAGE_ASPECTS
}

/** Studio inputs start empty; catalogue examples must never become user references. */
export function cinematicImageForm(
  model: WorkshopModelDetail,
  settings: {
    prompt: string
    aspect: string
    resolutionPixels: number
    seed?: number
    references?: readonly File[]
  }
) {
  if (!model.execution || !canRunModel(model) || model.modality !== 'image')
    throw new WorkshopRouterError('unavailable')
  if (
    !imageAspectOptions(model.execution).includes(settings.aspect) ||
    !settings.prompt.trim() ||
    !Number.isFinite(settings.resolutionPixels) ||
    settings.resolutionPixels <= 0 ||
    (settings.references?.length ?? 0) > referenceCapacity(model.execution)
  )
    throw new WorkshopRouterError('validation')
  const seed = cinematicSeedDescriptor(model.execution)
  if (
    settings.seed !== undefined &&
    (!seed ||
      !Number.isFinite(settings.seed) ||
      (seed.step !== 'any' && !Number.isInteger(settings.seed)) ||
      (seed.minimum !== undefined && settings.seed < seed.minimum) ||
      (seed.maximum !== undefined && settings.seed > seed.maximum))
  )
    throw new WorkshopRouterError('validation')
  const schema = workshopPageSchema(model)
  const ratio = dimensions(settings.aspect)
  const exactSizes = schema.flatMap((field) => {
    if (field.kind !== 'select' || !/(?:size|resolution)/i.test(field.name))
      return []
    const choices = field.options
      .flatMap((value) => {
        const size = dimensions(value)
        return ratio &&
          size &&
          size.width >= 100 &&
          Math.abs(size.width / size.height - ratio.width / ratio.height) <
            0.001
          ? [{ value, size }]
          : []
      })
      .sort(
        (a, b) =>
          Math.abs(
            Math.max(a.size.width, a.size.height) - settings.resolutionPixels
          ) -
          Math.abs(
            Math.max(b.size.width, b.size.height) - settings.resolutionPixels
          )
      )
    return choices.length ? [[field.name, choices[0].value] as const] : []
  })
  return {
    schema,
    values: mapRouterParameters(
      schema,
      defaultValues(schema),
      {
        prompt: settings.prompt,
        aspect_ratio: settings.aspect,
        resolution: settings.resolutionPixels,
        ...(settings.seed !== undefined ? { seed: settings.seed } : {}),
        ...(settings.references?.length
          ? { reference_images: settings.references }
          : {}),
        ...(exactSizes.length
          ? { model_specific: Object.fromEntries(exactSizes) }
          : {})
      },
      routerParameterMappings(model.execution, model.modality)
    )
  }
}

function referenceCapacity(contract: WorkshopContract): number {
  const schema = schemaForModel({ fields: [], form: formForContract(contract) })
  const mappings = routerParameterMappings(contract)
  return schema.reduce((total, field) => {
    const media = field.kind === 'file' ? field : urlUploadField(field)
    if (!media) return total
    const mapped = createRouterParameters(
      [field],
      defaultValues([field]),
      mappings
    ).router_get_closest_value(
      field.kind === 'file'
        ? []
        : Array.from({ length: 10 }, () => 'https://example.com/reference.png'),
      'reference_images'
    )
    return total + (mapped !== undefined ? (media.maxItems ?? 1) : 0)
  }, 0)
}

const REFERENCE_ROUTES: Readonly<Record<string, string>> = {
  'qwen--qwen-image-3.0-text-to-image--generate-images':
    'qwen--qwen-image-3.0-image-edit--edit-images',
  'qwen--qwen-image-3.0-pro-text-to-image--generate-images':
    'qwen--qwen-image-3.0-pro-image-edit--edit-images',
  'byteplus--seedream-5-pro--generate-images':
    'byteplus--seedream-5-pro--edit-images',
  'vertexai--gemini-nano-banana-2--generate-images':
    'vertexai--gemini-nano-banana-2--edit-images',
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

export function cinematicSeedDescriptor(
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
  'ltx--text-to-video-v2--generate-videos',
  'ltx--ltx-2-5-fast--generate-videos',
  'kling--v3--generate-videos',
  'kling--omni-pro-text-to-video--generate-videos',
  'byteplus--seedance-2-text-to-video--generate-videos',
  'byteplus--seedance-2-image-to-video--animate-images',
  'byteplus--seedance-2-fast-text-to-video--generate-videos',
  'byteplus--seedance-2-fast-first-last-frame--animate-images',
  'xai--grok-imagine-video-1.5--generate-videos',
  'xai--grok-imagine-video-1.5--animate-images'
])

const CINEMATIC_MODEL_LOGOS: Readonly<Record<string, string>> = {
  'byteplus--seedream-4-5--generate-images': '/icons/ai-models/bytedance.svg',
  'vertexai--gemini-3-pro-image--generate-images':
    '/icons/ai-models/gemini.svg',
  'bfl--flux-2-pro--generate-images': '/icons/ai-models/bfl.svg',
  'krea--krea-2-large--generate-images': '/icons/ai-models/krea.svg',
  'qwen--qwen-image-3.0-pro-text-to-image--generate-images':
    '/icons/ai-models/qwen.svg',
  'byteplus--seedream-5-pro--generate-images': '/icons/ai-models/bytedance.svg',
  'bfl--flux-2-max--generate-images': '/icons/ai-models/bfl.svg',
  'vertexai--gemini-nano-banana-2--generate-images':
    '/icons/ai-models/gemini.svg',
  'qwen--qwen-image-3.0-text-to-image--generate-images':
    '/icons/ai-models/qwen.svg',
  'openai--gpt-image-2--generate-images': '/icons/ai-models/openai.svg',
  'openai--gpt-image-2.5-flare--generate-images': '/icons/ai-models/openai.svg',
  'openai--gpt-image-2.5-sunburst--generate-images':
    '/icons/ai-models/openai.svg',
  'xai--grok-imagine-image-2.0--generate-images': '/icons/ai-models/grok.svg',
  'recraft--v4.1-text-to-image--generate-images':
    '/icons/ai-models/recraft.svg',
  'byteplus--seedance-2-5-text-to-video--generate-videos':
    '/icons/ai-models/bytedance.svg',
  'byteplus--seedance-2-5-first-last-frame--animate-images':
    '/icons/ai-models/bytedance.svg',
  ...Object.fromEntries(
    [...VIDEO_SLUGS]
      .filter((slug) => !slug.startsWith('byteplus--seedance-2-5'))
      .map((slug) => [
        slug,
        slug.startsWith('wan--')
          ? '/icons/ai-models/wan.svg'
          : slug.startsWith('ltx--')
            ? '/icons/ai-models/ltxv.svg'
            : slug.startsWith('byteplus--')
              ? '/icons/ai-models/bytedance.svg'
              : slug.startsWith('kling--')
                ? '/icons/ai-models/kling.svg'
                : '/icons/ai-models/grok.svg'
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
            ...(!video && model.execution
              ? { imageAspects: imageAspectOptions(model.execution) }
              : {}),
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
